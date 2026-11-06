/**
 * Données de démonstration – TOUTES FICTIVES et marquées `isDemo = true` (EXG-16).
 *
 * Les noms de quartiers reprennent les exemples du cahier des charges (§9) sans prétendre
 * à l'exactitude de la hiérarchie administrative ni des limites : la commune est une
 * commune de démonstration, les repères et positions sont indicatifs. La liste réelle du
 * pilote et la source des repères restent à décider (docs/DECISIONS.md).
 *
 * Le script est rejouable : il supprime d'abord les seules lignes de démonstration.
 */
import 'dotenv/config';
import sharp from 'sharp';
import { hashPassword } from '../src/lib/auth/password';
import { seal } from '../src/lib/auth/secret-box';
import { processPhoto } from '../src/lib/photos/process';
import { photoStorage } from '../src/lib/photos/storage';
import { readFile } from 'node:fs/promises';
import { createPrismaClient } from '../src/lib/db';
import { DEFAULT_ESCALATION_RULES } from '../src/lib/escalation/rules';
import { DEFAULT_RULE_NAME, DEFAULT_RULE_PARAMS } from '../src/lib/risk/rules';
import { loadCellsIntoDatabase, type CellDataset } from '../src/services/risk/cells';
import type { Prisma } from '../src/generated/prisma/client';

const prisma = createPrismaClient();

export const DEMO_DEPARTMENT = 'Pikine';
export const DEMO_COMMUNE = 'Commune de démonstration';

const neighborhoods = [
  {
    name: 'Thiaroye Gare',
    aliases: [{ alias: 'Thiaroye Gare (démo)', locale: 'fr' }],
    landmarks: [
      { name: 'Repère démo – gare (fictif)', kind: 'STATION', lat: 14.7488, lng: -17.3812 },
      { name: 'Repère démo – marché (fictif)', kind: 'MARKET', lat: 14.7465, lng: -17.379 },
    ],
  },
  {
    name: 'Thiaroye sur Mer',
    aliases: [{ alias: 'Thiaroye-sur-Mer', locale: 'fr' }],
    landmarks: [
      { name: 'Repère démo – école (fictif)', kind: 'SCHOOL', lat: 14.7402, lng: -17.3655 },
      { name: 'Repère démo – mosquée (fictif)', kind: 'MOSQUE', lat: 14.7421, lng: -17.3622 },
    ],
  },
  {
    name: 'Diamaguène',
    aliases: [{ alias: 'Diamaguene', locale: 'fr' }],
    landmarks: [
      {
        name: 'Repère démo – centre de santé (fictif)',
        kind: 'HEALTH',
        lat: 14.7605,
        lng: -17.3905,
      },
    ],
  },
] as const;

const testAccounts = [
  {
    key: 'citizen',
    name: 'Habitant Démo',
    email: 'habitant.demo@banlieue-alerte.test',
    role: 'CITIZEN',
  },
  {
    key: 'delegate',
    name: 'Délégué Démo',
    email: 'delegue.demo@banlieue-alerte.test',
    role: 'DELEGATE',
  },
  { key: 'agent', name: 'Agent Démo', email: 'agent.demo@banlieue-alerte.test', role: 'AGENT' },
  {
    key: 'admin',
    name: 'Administrateur Démo',
    email: 'admin.demo@banlieue-alerte.test',
    role: 'ADMIN',
  },
] as const;

async function clearDemoData() {
  // Ordre imposé par les clés étrangères.
  // Phase 5 : épisodes, étiquettes et opérations de démonstration ou créés par les comptes de test.
  await prisma.episodeLabelHistory.deleteMany({ where: { changedBy: { isDemo: true } } });
  await prisma.episodeLabel.deleteMany({ where: { labeledBy: { isDemo: true } } });
  await prisma.rainEpisode.deleteMany({
    where: {
      OR: [{ isDemo: true }, { createdBy: { isDemo: true } }, { validatedBy: { isDemo: true } }],
    },
  });
  await prisma.cleanupOperation.deleteMany({
    where: { OR: [{ isDemo: true }, { createdBy: { isDemo: true } }] },
  });
  // Phase 4 : alertes, exécutions de l'indice et relevés météo de démonstration ou créés
  // par les comptes de test.
  await prisma.alert.deleteMany({
    where: {
      OR: [
        { isDemo: true },
        { createdBy: { isDemo: true } },
        { approvals: { some: { approver: { isDemo: true } } } },
      ],
    },
  });
  await prisma.riskRun.deleteMany({ where: { isDemo: true } });
  await prisma.weatherSnapshot.deleteMany({ where: { isDemo: true, runs: { none: {} } } });
  await prisma.ruleVersion.updateMany({
    where: { createdBy: { isDemo: true } },
    data: { createdById: null },
  });
  await prisma.riskCell.deleteMany({ where: { isDemo: true } });
  await prisma.reportStatusHistory.deleteMany({ where: { report: { isDemo: true } } });
  await prisma.reportPhoto.deleteMany({ where: { report: { isDemo: true } } });
  await prisma.reportComment.deleteMany({ where: { report: { isDemo: true } } });
  await prisma.report.deleteMany({ where: { isDemo: true } });
  await prisma.neighborhood.deleteMany({ where: { isDemo: true } });
  // Liens créés par ou pour les comptes de test (clés étrangères obligatoires).
  await prisma.passwordReset.deleteMany({
    where: { OR: [{ user: { isDemo: true } }, { createdBy: { isDemo: true } }] },
  });
  await prisma.invitation.deleteMany({ where: { createdBy: { isDemo: true } } });
  await prisma.user.deleteMany({ where: { isDemo: true } });
  await prisma.commune.deleteMany({ where: { isDemo: true } });
}

async function main() {
  const testPassword = process.env.SEED_TEST_PASSWORD;
  if (!testPassword) throw new Error('SEED_TEST_PASSWORD manquant (voir .env.example).');

  await clearDemoData();

  const commune = await prisma.commune.create({
    data: { name: DEMO_COMMUNE, department: DEMO_DEPARTMENT, isDemo: true },
  });

  const passwordHash = await hashPassword(testPassword);
  const users: Record<(typeof testAccounts)[number]['key'], { id: string }> = {} as never;
  for (const account of testAccounts) {
    users[account.key] = await prisma.user.create({
      data: {
        name: account.name,
        email: account.email,
        role: account.role,
        passwordHash,
        communeId: account.role === 'AGENT' ? commune.id : null,
        // Administrateur de démonstration : second facteur déjà configuré avec le secret
        // de test de .env (EXG-41). Sans ce secret, il s'enrôle à sa première connexion.
        ...(account.role === 'ADMIN' && process.env.SEED_TEST_TOTP_SECRET
          ? { totpSecret: seal(process.env.SEED_TEST_TOTP_SECRET), totpEnabledAt: new Date() }
          : {}),
        isDemo: true,
      },
      select: { id: true },
    });
  }

  const created = [];
  for (const [index, item] of neighborhoods.entries()) {
    created.push(
      await prisma.neighborhood.create({
        data: {
          name: item.name,
          communeId: commune.id,
          boundaryStatus: 'APPROXIMATE',
          // Indicateur pilote de démonstration ; la vraie liste reste à décider.
          isPilot: true,
          delegateId: index === 0 ? users.delegate.id : null,
          isDemo: true,
          aliases: { create: item.aliases.map((alias) => ({ ...alias, isDemo: true })) },
          landmarks: {
            create: item.landmarks.map((landmark) => ({
              ...landmark,
              radiusMeters: 400,
              source: 'Démonstration – position indicative, non vérifiée',
              isDemo: true,
            })),
          },
        },
        select: { id: true, name: true },
      }),
    );
  }

  const [gare, surMer, diamaguene] = created;
  if (!gare || !surMer || !diamaguene) throw new Error('Quartiers de démonstration manquants.');

  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

  type DemoReport = Omit<Prisma.ReportUncheckedCreateInput, 'isDemo'> & {
    history: {
      from: Prisma.ReportStatusHistoryCreateManyInput['fromStatus'];
      to: Prisma.ReportStatusHistoryCreateManyInput['toStatus'];
    }[];
  };

  const reports: DemoReport[] = [
    {
      trackingCode: 'BA-DEMO-0001',
      type: 'FLOODING',
      severity: 'HIGH',
      description: 'Démonstration : eau stagnante sur la voie principale.',
      lat: 14.7481,
      lng: -17.3805,
      neighborhoodId: gare.id,
      status: 'IN_PROGRESS',
      authorId: users.citizen.id,
      confirmationCount: 4,
      createdAt: hoursAgo(30),
      history: [
        { from: null, to: 'NEW' },
        { from: 'NEW', to: 'VERIFIED' },
        { from: 'VERIFIED', to: 'ASSIGNED' },
        { from: 'ASSIGNED', to: 'IN_PROGRESS' },
      ],
    },
    {
      trackingCode: 'BA-DEMO-0002',
      type: 'BLOCKED_DRAIN',
      severity: 'MEDIUM',
      description: 'Démonstration : caniveau obstrué par du sable.',
      lat: 14.7469,
      lng: -17.3795,
      neighborhoodId: gare.id,
      status: 'NEW',
      createdAt: hoursAgo(5),
      history: [{ from: null, to: 'NEW' }],
    },
    {
      trackingCode: 'BA-DEMO-0003',
      type: 'WASTE_DUMP',
      severity: 'MEDIUM',
      description: 'Démonstration : dépôt d’ordures près du caniveau.',
      lat: 14.741,
      lng: -17.364,
      neighborhoodId: surMer.id,
      status: 'VERIFIED',
      confirmationCount: 2,
      createdAt: hoursAgo(50),
      history: [
        { from: null, to: 'NEW' },
        { from: 'NEW', to: 'VERIFIED' },
      ],
    },
    {
      trackingCode: 'BA-DEMO-0004',
      type: 'FLOODING',
      severity: 'LOW',
      lat: 14.7598,
      lng: -17.3899,
      neighborhoodId: diamaguene.id,
      status: 'RESOLVED',
      createdAt: hoursAgo(120),
      resolvedAt: hoursAgo(72),
      history: [
        { from: null, to: 'NEW' },
        { from: 'NEW', to: 'VERIFIED' },
        { from: 'VERIFIED', to: 'RESOLVED' },
      ],
    },
    {
      // Hors de tout repère : « quartier non identifié », traité par un agent.
      trackingCode: 'BA-DEMO-0005',
      type: 'ROAD_CUT',
      severity: 'HIGH',
      description: 'Démonstration : passage impraticable.',
      lat: 14.77,
      lng: -17.35,
      neighborhoodId: null,
      attachment: 'UNIDENTIFIED',
      status: 'NEW',
      createdAt: hoursAgo(2),
      history: [{ from: null, to: 'NEW' }],
    },
  ];

  // Photo de démonstration, générée et marquée comme telle (aucune vraie photo).
  const demoPhoto = await processPhoto(
    await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#0B6FA4' } })
      .composite([
        {
          input: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><text x="600" y="420" font-family="sans-serif" font-size="64" fill="#FFFFFF" text-anchor="middle">Photo de démonstration</text></svg>',
          ),
        },
      ])
      .jpeg()
      .toBuffer(),
  );
  const demoPhotoKey = await photoStorage.save(demoPhoto.data);

  for (const { history, ...data } of reports) {
    const withPhoto = data.trackingCode === 'BA-DEMO-0001';
    const report = await prisma.report.create({
      data: {
        ...data,
        isDemo: true,
        ...(withPhoto
          ? {
              photos: {
                create: {
                  storageKey: demoPhotoKey,
                  mimeType: demoPhoto.mimeType,
                  sizeBytes: demoPhoto.data.length,
                  width: demoPhoto.width,
                  height: demoPhoto.height,
                },
              },
            }
          : {}),
      },
      select: { id: true },
    });
    await prisma.reportStatusHistory.createMany({
      data: history.map((step, i) => ({
        reportId: report.id,
        fromStatus: step.from,
        toStatus: step.to,
        changedById: step.from === null ? null : users.agent.id,
        createdAt: new Date(new Date(data.createdAt as Date).getTime() + i * 3_600_000),
      })),
    });
  }

  // Traitement de démonstration : BA-DEMO-0001 assigné à l'agent, avec une note interne
  // (jamais publiée) et un commentaire public d'habitant.
  const inProgress = await prisma.report.update({
    where: { trackingCode: 'BA-DEMO-0001' },
    data: { assigneeId: users.agent.id },
    select: { id: true },
  });
  await prisma.reportComment.createMany({
    data: [
      {
        reportId: inProgress.id,
        authorId: users.agent.id,
        body: 'Démonstration : équipe de pompage prévue demain matin.',
        isInternal: true,
        isDemo: true,
      },
      {
        reportId: inProgress.id,
        authorId: users.citizen.id,
        body: 'Démonstration : l’eau est encore haute devant le marché.',
        isDemo: true,
      },
    ],
  });

  // --- Phase 4 : grille de cellules, grille de règles, alertes et abonnement ---------------
  // Altitudes SRTM précalculées (npm run risk:cells), cellules rattachées aux quartiers démo.
  const dataset = JSON.parse(await readFile('prisma/data/risk-cells.json', 'utf8')) as CellDataset;
  const cells = await loadCellsIntoDatabase(prisma, dataset, { isDemo: true });

  // Grille v1 : configuration (et non donnée de démonstration), créée une seule fois.
  if ((await prisma.ruleVersion.count()) === 0) {
    await prisma.ruleVersion.create({
      data: {
        number: 1,
        name: DEFAULT_RULE_NAME,
        notes:
          'Hypothèse de départ (D-046), à valider avec des délégués ou un expert (ANACIM, service technique).',
        params: DEFAULT_RULE_PARAMS,
        isActive: true,
        activatedAt: new Date(),
      },
    });
  }

  // Règles d'escalade (configuration, D-056) : créées une seule fois.
  if ((await prisma.escalationRule.count()) === 0) {
    await prisma.escalationRule.createMany({ data: DEFAULT_ESCALATION_RULES });
  }

  // Épisode de démonstration, avec quelques étiquettes démo : exclus de la qualité (D-054).
  const gareCells = await prisma.riskCell.findMany({
    where: { neighborhoodId: gare.id },
    select: { id: true },
    take: 4,
  });
  await prisma.rainEpisode.create({
    data: {
      name: 'Démonstration : forte pluie fictive',
      startsAt: hoursAgo(80),
      endsAt: hoursAgo(70),
      status: 'OPEN',
      createdById: users.agent.id,
      isDemo: true,
      labels: {
        create: gareCells.slice(0, 2).map((cell, i) => ({
          cellId: cell.id,
          label: i === 0 ? ('FLOODED' as const) : ('NOT_FLOODED' as const),
          labeledById: users.delegate.id,
          isDemo: true,
        })),
      },
    },
  });

  // Opération de curage de démonstration sur le caniveau BA-DEMO-0002.
  const drain = await prisma.report.findUniqueOrThrow({
    where: { trackingCode: 'BA-DEMO-0002' },
    select: { id: true },
  });
  await prisma.cleanupOperation.create({
    data: {
      reportId: drain.id,
      team: 'Équipe de démonstration',
      status: 'PLANNED',
      plannedFor: new Date(Date.now() + 24 * 3_600_000),
      note: 'Démonstration : curage fictif.',
      createdById: users.agent.id,
      isDemo: true,
    },
  });

  // Alerte officielle passée, d'un émetteur explicitement fictif (historique de démonstration).
  const pastOfficial = await prisma.alert.create({
    data: {
      type: 'OFFICIAL',
      status: 'SENT',
      origin: 'MANUAL',
      level: 'HIGH',
      issuerName: 'Émetteur de démonstration (fictif)',
      title: 'Démonstration : fortes pluies, vigilance à Thiaroye Gare',
      messageFr:
        'Démonstration : message d’alerte fictif. Évitez les zones basses près de la gare.',
      advice: 'Démonstration : conseils de prudence.',
      validFrom: hoursAgo(80),
      validUntil: hoursAgo(56),
      sentAt: hoursAgo(79),
      createdById: users.agent.id,
      isDemo: true,
      createdAt: hoursAgo(81),
      neighborhoods: { create: { neighborhoodId: gare.id } },
    },
    select: { id: true },
  });
  await prisma.alertApproval.create({
    data: {
      alertId: pastOfficial.id,
      approverId: users.agent.id,
      decision: 'APPROVED',
      createdAt: hoursAgo(79),
    },
  });

  // Brouillon indicatif en attente d'approbation (rien n'est envoyé sans décision humaine).
  await prisma.alert.create({
    data: {
      type: 'INDICATIVE',
      status: 'PENDING_APPROVAL',
      origin: 'MANUAL',
      level: 'MODERATE',
      issuerName: 'Délégué de quartier (démonstration)',
      title: 'Démonstration : caniveaux bouchés à Thiaroye Gare',
      messageFr:
        'Démonstration : plusieurs caniveaux sont signalés obstrués. Indicatif, ne remplace pas les alertes officielles.',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 24 * 3_600_000),
      createdById: users.delegate.id,
      isDemo: true,
      neighborhoods: { create: { neighborhoodId: gare.id } },
    },
  });

  // Abonnement de l'habitant de démonstration aux trois quartiers démo : quel que soit le
  // brouillon approuvé pendant la démonstration, la notification lui parvient (docs/DEMO.md).
  await prisma.subscription.create({
    data: {
      userId: users.citizen.id,
      minLevel: 'MODERATE',
      channelInApp: true,
      channelWebPush: true,
      isDemo: true,
      neighborhoods: {
        create: [gare, surMer, diamaguene].map((n) => ({ neighborhoodId: n.id })),
      },
    },
  });

  console.log(
    `Indice : ${cells.cells} cellules (${cells.attached} rattachées à un quartier) ; 2 alertes et 1 abonnement de démonstration.`,
  );

  console.log(
    `Seed de démonstration : 1 commune, ${created.length} quartiers, ${testAccounts.length} comptes de test, ${reports.length} signalements (tous marqués isDemo).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
