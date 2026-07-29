/* eslint-disable jsx-a11y/alt-text -- React PDF's Image primitive is not a DOM img and has no alt prop. */

import {
  Document,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type {
  RoutinePdfDay,
  RoutinePdfExercise,
  RoutinePdfExport,
} from "@/application/routines/routine-pdf-export";

Font.registerHyphenationCallback((word) => [word]);

const colors = {
  navy: "#002855",
  navySoft: "#123d69",
  ink: "#09233f",
  muted: "#5e7085",
  line: "#c7d2df",
  pale: "#eef4f8",
  paper: "#fbfaf8",
  green: "#1e7a4a",
  greenPale: "#e9f6ee",
  orange: "#c8651a",
  orangePale: "#fff2e6",
  white: "#ffffff",
} as const;

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.35,
    paddingBottom: 42,
    paddingHorizontal: 34,
    paddingTop: 34,
  },
  cover: {
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: "Helvetica",
    paddingBottom: 42,
  },
  coverHero: {
    backgroundColor: colors.navy,
    color: colors.white,
    minHeight: 280,
    paddingBottom: 34,
    paddingHorizontal: 38,
    paddingTop: 40,
  },
  brand: {
    fontFamily: "Helvetica-Bold",
    fontSize: 24,
    letterSpacing: -0.8,
  },
  coverKicker: {
    color: "#b9cee1",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 2.1,
    marginTop: 54,
    textTransform: "uppercase",
  },
  coverTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 30,
    letterSpacing: -0.8,
    lineHeight: 1.05,
    marginTop: 10,
    maxWidth: 470,
  },
  coverSummary: {
    color: "#dce8f1",
    fontSize: 11,
    lineHeight: 1.5,
    marginTop: 16,
    maxWidth: 470,
  },
  coverBody: {
    paddingHorizontal: 38,
    paddingTop: 24,
  },
  stats: {
    display: "flex",
    flexDirection: "row",
    marginBottom: 24,
  },
  stat: {
    borderLeftColor: colors.line,
    borderLeftWidth: 1,
    paddingLeft: 11,
    width: "25%",
  },
  statFirst: {
    borderLeftColor: colors.green,
    borderLeftWidth: 3,
  },
  statLabel: {
    color: colors.muted,
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    letterSpacing: 0.7,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  sectionKicker: {
    color: colors.muted,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 17,
    lineHeight: 1.15,
    marginBottom: 12,
  },
  weekRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    display: "flex",
    flexDirection: "row",
    minHeight: 32,
    paddingVertical: 7,
  },
  weekDay: {
    color: colors.navy,
    fontFamily: "Helvetica-Bold",
    width: "12%",
  },
  weekName: {
    fontFamily: "Helvetica-Bold",
    width: "31%",
  },
  weekFocus: {
    color: colors.muted,
    paddingRight: 8,
    width: "39%",
  },
  weekTime: {
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    width: "18%",
  },
  coverNotice: {
    backgroundColor: colors.greenPale,
    borderColor: "#acd1bc",
    borderWidth: 1,
    color: "#28583e",
    fontSize: 8,
    lineHeight: 1.45,
    marginTop: 20,
    padding: 11,
  },
  topRule: {
    backgroundColor: colors.navy,
    height: 5,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  runningHeader: {
    alignItems: "center",
    color: colors.muted,
    display: "flex",
    flexDirection: "row",
    fontSize: 7,
    justifyContent: "space-between",
    left: 34,
    letterSpacing: 0.8,
    position: "absolute",
    right: 34,
    textTransform: "uppercase",
    top: 15,
  },
  runningBrand: {
    color: colors.navy,
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 0.7,
    bottom: 17,
    color: colors.muted,
    display: "flex",
    flexDirection: "row",
    fontSize: 6.5,
    justifyContent: "space-between",
    left: 34,
    paddingTop: 6,
    position: "absolute",
    right: 34,
  },
  dayHero: {
    backgroundColor: colors.navy,
    color: colors.white,
    marginBottom: 15,
    marginHorizontal: -10,
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  dayKicker: {
    color: "#b9cee1",
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  dayTitleRow: {
    alignItems: "flex-end",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  dayTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 23,
    lineHeight: 1.08,
    maxWidth: "72%",
  },
  dayTime: {
    backgroundColor: colors.white,
    color: colors.navy,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  dayFocus: {
    color: "#dce8f1",
    fontSize: 9,
    marginTop: 8,
  },
  blocks: {
    backgroundColor: colors.pale,
    borderColor: colors.line,
    borderWidth: 1,
    marginBottom: 15,
    padding: 10,
  },
  blocksTitle: {
    color: colors.navy,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  blockRow: {
    display: "flex",
    flexDirection: "row",
    marginTop: 4,
  },
  blockTime: {
    color: colors.green,
    fontFamily: "Helvetica-Bold",
    width: 38,
  },
  blockText: {
    flex: 1,
  },
  blockName: {
    fontFamily: "Helvetica-Bold",
  },
  exerciseCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    marginBottom: 12,
    padding: 11,
  },
  exerciseHeader: {
    alignItems: "flex-start",
    display: "flex",
    flexDirection: "row",
    marginBottom: 8,
  },
  order: {
    backgroundColor: colors.navy,
    color: colors.white,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    marginRight: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  exerciseHeading: {
    flex: 1,
  },
  exerciseName: {
    color: colors.navy,
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    lineHeight: 1.15,
  },
  exerciseMeta: {
    color: colors.muted,
    fontSize: 7.5,
    marginTop: 3,
    textTransform: "uppercase",
  },
  exerciseBody: {
    display: "flex",
    flexDirection: "row",
  },
  mediaColumn: {
    marginRight: 12,
    width: 105,
  },
  exerciseImage: {
    backgroundColor: colors.pale,
    height: 105,
    objectFit: "contain",
    width: 105,
  },
  imagePlaceholder: {
    alignItems: "center",
    backgroundColor: colors.pale,
    borderColor: colors.line,
    borderWidth: 1,
    color: colors.muted,
    display: "flex",
    fontSize: 7,
    height: 105,
    justifyContent: "center",
    paddingHorizontal: 8,
    textAlign: "center",
    width: 105,
  },
  attribution: {
    color: colors.muted,
    fontSize: 5.5,
    lineHeight: 1.25,
    marginTop: 4,
  },
  detailsColumn: {
    flex: 1,
  },
  prescription: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    display: "flex",
    flexDirection: "row",
    marginBottom: 8,
  },
  prescriptionCell: {
    borderRightColor: colors.line,
    borderRightWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 5,
    width: "25%",
  },
  prescriptionCellLast: {
    borderRightWidth: 0,
  },
  prescriptionLabel: {
    color: colors.muted,
    fontFamily: "Helvetica-Bold",
    fontSize: 5.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  prescriptionValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    marginTop: 2,
  },
  miniTitle: {
    color: colors.navy,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 0.5,
    marginBottom: 3,
    marginTop: 5,
    textTransform: "uppercase",
  },
  reason: {
    color: colors.muted,
    fontSize: 7.5,
    marginBottom: 2,
  },
  step: {
    display: "flex",
    flexDirection: "row",
    fontSize: 7.6,
    lineHeight: 1.35,
    marginBottom: 3,
  },
  stepNumber: {
    color: colors.green,
    fontFamily: "Helvetica-Bold",
    width: 16,
  },
  stepText: {
    flex: 1,
  },
  exerciseLink: {
    color: colors.navy,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    marginTop: 7,
    textDecoration: "none",
  },
  notesHero: {
    backgroundColor: colors.navy,
    color: colors.white,
    marginBottom: 20,
    marginHorizontal: -10,
    padding: 20,
  },
  notesTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    marginTop: 5,
  },
  noteSection: {
    marginBottom: 18,
  },
  noteListItem: {
    display: "flex",
    flexDirection: "row",
    marginBottom: 5,
  },
  noteBullet: {
    color: colors.green,
    fontFamily: "Helvetica-Bold",
    width: 14,
  },
  noteText: {
    flex: 1,
  },
  legalBox: {
    backgroundColor: colors.orangePale,
    borderColor: "#e4ae81",
    borderWidth: 1,
    color: "#75401a",
    marginBottom: 18,
    padding: 12,
  },
  legalTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 5,
  },
  sourceLink: {
    color: colors.navy,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    textDecoration: "none",
  },
});

function formatGeneratedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function goalLabel(goal: string): string {
  const labels: Readonly<Record<string, string>> = {
    hypertrophy: "Hipertrofia",
    strength: "Fuerza",
    general_fitness: "Estado físico general",
    muscular_endurance: "Resistencia muscular",
  };
  return labels[goal] ?? goal;
}

function PageChrome({ section }: { section: string }) {
  return (
    <>
      <View fixed style={styles.topRule} />
      <View fixed style={styles.runningHeader}>
        <Text style={styles.runningBrand}>FORMA</Text>
        <Text>{section}</Text>
      </View>
      <View fixed style={styles.footer}>
        <Text>Rutina educativa · Revisá técnica y cargas antes de entrenar</Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </View>
    </>
  );
}

function CoverPage({ data }: { data: RoutinePdfExport }) {
  return (
    <Page size="A4" style={styles.cover} bookmark="Resumen">
      <View style={styles.coverHero}>
        <Text style={styles.brand}>FORMA</Text>
        <Text style={styles.coverKicker}>Tu rutina validada</Text>
        <Text style={styles.coverTitle}>{data.title}</Text>
        <Text style={styles.coverSummary}>{data.summary}</Text>
      </View>
      <View style={styles.coverBody}>
        <View style={styles.stats}>
          <View style={[styles.stat, styles.statFirst]}>
            <Text style={styles.statLabel}>Objetivo</Text>
            <Text style={styles.statValue}>{goalLabel(data.goal)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>División</Text>
            <Text style={styles.statValue}>{data.splitName}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Frecuencia</Text>
            <Text style={styles.statValue}>{data.daysPerWeek} días</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Tiempo semanal</Text>
            <Text style={styles.statValue}>{data.totalMinutes} min</Text>
          </View>
        </View>

        <Text style={styles.sectionKicker}>Vista semanal</Text>
        <Text style={styles.sectionTitle}>Tu plan, día por día</Text>
        {data.days.map((day) => (
          <Link
            key={day.id}
            src={`#day-${day.id}`}
            style={{ color: colors.ink, textDecoration: "none" }}
          >
            <View style={styles.weekRow}>
              <Text style={styles.weekDay}>DÍA {day.position}</Text>
              <Text style={styles.weekName}>{day.name}</Text>
              <Text style={styles.weekFocus}>{day.focus}</Text>
              <Text style={styles.weekTime}>{day.estimatedMinutes} min</Text>
            </View>
          </Link>
        ))}
        <Text style={styles.coverNotice}>
          Incluye {data.totalExercises} ejercicios con imagen estática, prescripción,
          explicación e instrucciones. El PDF conserva enlaces a la ficha y a la
          demostración animada en FORMA.
        </Text>
      </View>
      <View fixed style={styles.footer}>
        <Text>Generada el {formatGeneratedDate(data.generatedAt)}</Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </View>
    </Page>
  );
}

function SessionBlocks({ day }: { day: RoutinePdfDay }) {
  if (day.sessionBlocks.length === 0) return null;
  return (
    <View style={styles.blocks} wrap={false}>
      <Text style={styles.blocksTitle}>Preparación y cierre · incluidos en el tiempo</Text>
      {day.sessionBlocks.map((block) => (
        <View key={`${block.kind}-${block.title}`} style={styles.blockRow}>
          <Text style={styles.blockTime}>{block.estimatedMinutes} min</Text>
          <Text style={styles.blockText}>
            <Text style={styles.blockName}>{block.title}. </Text>
            {block.description}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PrescriptionCell({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.prescriptionCell,
        ...(last ? [styles.prescriptionCellLast] : []),
      ]}
    >
      <Text style={styles.prescriptionLabel}>{label}</Text>
      <Text style={styles.prescriptionValue}>{value}</Text>
    </View>
  );
}

function ExerciseCard({ exercise }: { exercise: RoutinePdfExercise }) {
  const steps =
    exercise.instructionSteps.length > 0
      ? exercise.instructionSteps
      : [exercise.instructionsFallback];
  const effort =
    exercise.prescription.rir === null
      ? "—"
      : `RIR ${exercise.prescription.rir} · RPE ${exercise.prescription.rpe}`;

  return (
    <View style={styles.exerciseCard} wrap={false}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.order}>{String(exercise.position).padStart(2, "0")}</Text>
        <View style={styles.exerciseHeading}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.exerciseMeta}>
            {exercise.muscles} · {exercise.equipment} · {exercise.difficulty}
          </Text>
        </View>
      </View>

      <View style={styles.exerciseBody}>
        <View style={styles.mediaColumn}>
          {exercise.imageDataUrl ? (
            <Image src={exercise.imageDataUrl} style={styles.exerciseImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text>Imagen no disponible en esta exportación</Text>
            </View>
          )}
          <Text style={styles.attribution}>
            {exercise.mediaAttribution ?? "Media no disponible · ver atribuciones"}
          </Text>
        </View>

        <View style={styles.detailsColumn}>
          <View style={styles.prescription}>
            <PrescriptionCell
              label="Series"
              value={String(exercise.prescription.sets)}
            />
            <PrescriptionCell
              label="Repeticiones"
              value={exercise.prescription.repetitions}
            />
            <PrescriptionCell
              label="Descanso"
              value={`${exercise.prescription.restSeconds} s`}
            />
            <PrescriptionCell label="Esfuerzo" value={effort} last />
          </View>

          <Text style={styles.miniTitle}>Por qué está acá</Text>
          {exercise.selectionReasons.slice(0, 3).map((reason) => (
            <Text key={reason} style={styles.reason}>• {reason}</Text>
          ))}
          {exercise.notes.length > 0 ? (
            <Text style={styles.reason}>Nota: {exercise.notes.join(" ")}</Text>
          ) : null}

          <Text style={styles.miniTitle}>Cómo realizarlo</Text>
          {steps.map((step, index) => (
            <View key={`${exercise.id}-step-${index}`} style={styles.step}>
              <Text style={styles.stepNumber}>{index + 1}.</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}

          <Link src={exercise.detailUrl} style={styles.exerciseLink}>
            Ver ficha y demostración animada en FORMA →
          </Link>
        </View>
      </View>
    </View>
  );
}

function DayPage({ day }: { day: RoutinePdfDay }) {
  return (
    <Page
      size="A4"
      style={styles.page}
      id={`day-${day.id}`}
      bookmark={`Día ${day.position}: ${day.name}`}
      wrap
    >
      <PageChrome section={`Día ${day.position} · ${day.name}`} />
      <View style={styles.dayHero}>
        <Text style={styles.dayKicker}>Día {day.position} de la semana</Text>
        <View style={styles.dayTitleRow}>
          <Text style={styles.dayTitle}>{day.name}</Text>
          <Text style={styles.dayTime}>{day.estimatedMinutes} min</Text>
        </View>
        <Text style={styles.dayFocus}>{day.focus}</Text>
      </View>
      <SessionBlocks day={day} />
      {day.exercises.map((exercise) => (
        <ExerciseCard key={`${day.id}-${exercise.id}`} exercise={exercise} />
      ))}
    </Page>
  );
}

function ListSection({
  title,
  values,
}: {
  title: string;
  values: readonly string[];
}) {
  if (values.length === 0) return null;
  return (
    <View style={styles.noteSection}>
      <Text style={styles.sectionKicker}>{title}</Text>
      {values.map((value) => (
        <View key={value} style={styles.noteListItem}>
          <Text style={styles.noteBullet}>•</Text>
          <Text style={styles.noteText}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function NotesPage({ data }: { data: RoutinePdfExport }) {
  return (
    <Page size="A4" style={styles.page} bookmark="Notas y fuentes">
      <PageChrome section="Notas y fuentes" />
      <View style={styles.notesHero}>
        <Text style={styles.dayKicker}>Antes de entrenar</Text>
        <Text style={styles.notesTitle}>Notas, fuentes y atribuciones</Text>
      </View>

      <View style={styles.legalBox}>
        <Text style={styles.legalTitle}>Uso responsable</Text>
        <Text>
          FORMA es una herramienta educativa. No evalúa lesiones, no prescribe
          rehabilitación y no reemplaza una indicación médica o profesional. Detené el
          ejercicio y buscá asistencia si aparece dolor o un síntoma inesperado.
        </Text>
      </View>

      <ListSection title="Observaciones del validador" values={data.warnings} />
      <ListSection title="Suposiciones del plan" values={data.assumptions} />
      <ListSection
        title="Atribución de imágenes"
        values={
          data.uniqueMediaAttributions.length > 0
            ? data.uniqueMediaAttributions
            : ["No se incorporaron imágenes protegidas en esta exportación."]
        }
      />
      <ListSection
        title="Origen de instrucciones y catálogo"
        values={data.uniqueSourceAttributions}
      />

      <View style={styles.legalBox}>
        <Text style={styles.legalTitle}>Estado de licencia de media</Text>
        <Text>
          Las imágenes se incluyen bajo autorización limitada del propietario para uso
          personal. La licencia pública o comercial continúa pendiente de revisión. No
          redistribuyas las imágenes por separado del documento.
        </Text>
      </View>

      <Text style={styles.sectionKicker}>Información técnica</Text>
      <Text>Motor: {data.engineVersion}</Text>
      <Text>Dataset: {data.datasetVersion}</Text>
      <Text>Generada el {formatGeneratedDate(data.generatedAt)}</Text>
      <Link src={data.attributionsUrl} style={styles.sourceLink}>
        Revisar fuentes y atribuciones completas en FORMA →
      </Link>
    </Page>
  );
}

export function RoutinePdfDocument({ data }: { data: RoutinePdfExport }) {
  return (
    <Document
      title={data.title}
      author="FORMA"
      subject="Rutina de entrenamiento validada"
      creator="FORMA"
      language="es-AR"
      pageMode="useOutlines"
      pageLayout="oneColumn"
    >
      <CoverPage data={data} />
      {data.days.map((day) => (
        <DayPage key={day.id} day={day} />
      ))}
      <NotesPage data={data} />
    </Document>
  );
}
