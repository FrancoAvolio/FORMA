#!/usr/bin/env node

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CURATED_DIRECTORY,
  DATASET_SOURCE,
  SOURCE_DIRECTORY,
} from "./lib/dataset-config.mjs";
import {
  curationReviewDigest,
  normalizeExercise,
  normalizeText,
  parseJsonBuffer,
} from "./lib/dataset-pipeline.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGET_QUOTAS = Object.freeze({
  back: { lats: 10, "upper back": 10, traps: 4, spine: 4 },
  chest: { pectorals: 22 },
  shoulders: { delts: 20 },
  "upper arms": { biceps: 14, triceps: 14 },
  "upper legs": { glutes: 14, quads: 12, hamstrings: 10, adductors: 2 },
  waist: { abs: 20 },
  "lower legs": { calves: 8 },
});

const ALLOWED_EQUIPMENT = new Set([
  "assisted",
  "band",
  "barbell",
  "body weight",
  "cable",
  "dumbbell",
  "ez barbell",
  "kettlebell",
  "leverage machine",
  "resistance band",
  "sled machine",
  "smith machine",
  "stability ball",
  "weighted",
]);

const MANDATORY_ADDITIONS = new Set([
  "3/4 sit-up",
  "bodyweight standing calf raise",
  "front plank with twist",
  "kettlebell goblet squat",
  "kettlebell one arm floor press",
  "kettlebell one arm row",
  "kettlebell seated press",
  "kettlebell swing",
  "lever pullover",
  "low glute bridge on floor",
  "push-up (wall)",
]);

// Source records whose names and instructions contradict each other, or whose
// unloaded prescription is not suitable for automatic routine generation.
const CURATION_EXCLUSION_REASONS = Object.freeze({
  "0024": "Source name claims a bench front squat, but its instructions describe a standard front squat.",
  "0026": "Source name claims a bench squat, but its instructions describe a standard rack squat.",
  "0044": "Loaded barbell good mornings require expert programming review before automatic generation.",
  "0068": "Loaded single-leg barbell squat requires advanced balance and expert programming review.",
  "0069": "Overhead squats require advanced mobility, technique and expert programming review.",
  "0071": "Barbell press sit-up combines loaded spinal flexion and pressing beyond the initial safety scope.",
  "0098": "Source name claims a split squat, but its instructions describe a bilateral wide-stance squat.",
  "0099": "Source instructions describe a barbell split squat, not the named single-leg/Bulgarian variant.",
  "0339": "Dumbbell lying femoral record has unclear loading and strength-prescription instructions.",
  "0410": "Required elevated supports are alternatives that the current equipment model cannot express.",
  "0496": "Source instructions describe an unloaded prone leg curl with unclear effective resistance.",
  "0489": "Duplicate hyperextension variant; the bench-specific reviewed record remains approved.",
  "0499": "The required waist-height bar or suspension trainer cannot be represented as equipment alternatives yet.",
  "0533": "Duplicate kettlebell goblet-squat instructions; the clearer goblet-squat record remains approved.",
  "0555": "Low-value kick-out sit variant is not sufficiently clear for automatic strength programming.",
  "0648": "Olympic power cleans require advanced coaching and are outside the initial automatic-generation scope.",
  "0750": "Smith chair-squat source and apparatus details require explicit equipment/programming review.",
  "0765": "Smith-machine source label conflicts with instructions for a handled seated press machine.",
  "0795": "Source instructions describe an unloaded standing leg curl with unclear effective resistance.",
  "0835": "Weighted-hyperextension label and unstable-ball prescription require explicit review.",
  "0861": "Duplicate seated cable-row variant; the clearer reviewed source record remains approved.",
  "1372": "Duplicate standing barbell calf-raise variant; the clearer source record remains approved.",
  "1452": "Duplicate seated machine-crunch variant; the chest-pad record remains approved.",
  "1489": "Sissy squats require explicit knee-tolerance and expert programming review.",
  "1511": "Static hamstring stretching is not a loaded routine exercise under the current prescription model.",
  "1587": "Yoga pose sequence is outside the initial resistance-routine prescription model.",
  "2133": "Loaded carries require distance/time prescriptions that the current routine schema does not support.",
  "2135": "Weighted-plank label conflicts with unweighted timed-hold source instructions.",
  "2400": "Source label/equipment conflict with instructions for a prone cable leg curl on a bench.",
  "2803": "Duplicate ordinary dumbbell-squat instructions under a misleading supported-squat label.",
  "2799": "Barbell seated alternating leg raise is obscure and requires explicit safety/programming review.",
  "3235": "Inverse-curl source label conflicts with instructions for a standard prone cable leg curl.",
  "3548": "Loaded carries require distance/time prescriptions that the current routine schema does not support.",
});
const CURATION_EXCLUDED_IDS = new Set(Object.keys(CURATION_EXCLUSION_REASONS));

const COMMON_NAME_SIGNALS = [
  /bench press/iu,
  /chest press/iu,
  /push-up/iu,
  /push up/iu,
  /pulldown/iu,
  /pull-up/iu,
  /chin-up/iu,
  /\brow\b/iu,
  /deadlift/iu,
  /squat/iu,
  /leg press/iu,
  /hip thrust/iu,
  /glute bridge/iu,
  /\blunge\b/iu,
  /split squat/iu,
  /step-up/iu,
  /leg curl/iu,
  /leg extension/iu,
  /calf raise/iu,
  /shoulder press/iu,
  /military press/iu,
  /lateral raise/iu,
  /front raise/iu,
  /reverse fly/iu,
  /face pull/iu,
  /shrug/iu,
  /biceps curl/iu,
  /hammer curl/iu,
  /preacher curl/iu,
  /triceps extension/iu,
  /pushdown/iu,
  /skull crusher/iu,
  /\bdip\b/iu,
  /\bfly\b/iu,
  /\bplank\b/iu,
  /\bcrunch\b/iu,
  /leg raise/iu,
  /sit-up/iu,
  /russian twist/iu,
  /rollout/iu,
  /good morning/iu,
  /pull through/iu,
  /back extension/iu,
  /hyperextension/iu,
];

const STANDARD_NAME_SIGNALS = [
  /^(?:barbell|dumbbell|cable|lever|smith machine) (?:decline |incline |seated |standing )?(?:bench|chest|shoulder) press$/iu,
  /^(?:barbell|dumbbell|cable|lever|smith machine) (?:seated |standing )?(?:military |shoulder )?press$/iu,
  /^(?:barbell|dumbbell|cable|lever|band) (?:incline |seated |standing |bent over )?(?:one arm )?row$/iu,
  /^(?:cable|lever|assisted|band) (?:front |lateral |reverse grip |wide grip )?pulldown$/iu,
  /^(?:assisted |weighted )?(?:pull-up|chin-up)$/iu,
  /^(?:barbell|dumbbell|cable|lever|smith machine|band) (?:front |rear |lateral |seated |standing |one arm )?(?:lateral raise|front raise|reverse fly|face pull|shrug)$/iu,
  /^(?:barbell|dumbbell|cable|lever|smith machine|band) (?:front |back |hack |goblet |sumo )?squat$/iu,
  /^(?:barbell|dumbbell|cable|lever|smith machine|band|kettlebell) (?:romanian |sumo |straight leg |stiff leg )?deadlift$/iu,
  /^(?:barbell|dumbbell|cable|lever|smith machine|band) (?:seated |lying |standing |kneeling )?(?:leg press|leg extension|leg curl|calf raise)$/iu,
  /^(?:barbell|dumbbell|cable|smith machine|band|bodyweight) (?:walking |reverse |forward |rear |side )?lunge$/iu,
  /^(?:barbell|dumbbell|cable|lever|smith machine|band) (?:one arm |incline |seated |standing |lying |preacher |hammer |concentration )?(?:biceps curl|curl)$/iu,
  /^(?:barbell|dumbbell|cable|lever|smith machine|band) (?:one arm |seated |standing |lying |overhead )?(?:triceps extension|pushdown)$/iu,
  /^(?:front |side |reverse )?plank$/iu,
  /^(?:cable|lever|weighted|decline|incline)? ?(?:kneeling |seated |standing )?(?:crunch|sit-up|leg raise|knee raise|russian twist)$/iu,
  /^(?:barbell|dumbbell|cable|lever|smith machine|band) (?:hip thrust|glute bridge|back extension|good morning)$/iu,
  /^(?:decline |incline |diamond |wide |close-grip )?push-up$/iu,
];

const PREFERRED_EXACT_NAMES = new Set([
  "assisted pull-up",
  "band assisted pull-up",
  "barbell bent over row",
  "barbell incline row",
  "barbell pendlay row",
  "barbell shrug",
  "cable low seated row",
  "cable pulldown",
  "cable seated row",
  "cable shrug",
  "cable straight arm pulldown",
  "chin-up",
  "dumbbell bent over row",
  "dumbbell incline row",
  "dumbbell one arm bent-over row",
  "dumbbell shrug",
  "inverted row",
  "lever back extension",
  "lever front pulldown",
  "lever seated row",
  "lever shrug",
  "lever t bar row",
  "pull-up",
  "reverse grip machine lat pulldown",
  "smith bent over row",
  "weighted pull-up",
  "wide grip pull-up",
  "back extension on exercise ball",
  "hyperextension",
  "hyperextension (on bench)",
  "weighted hyperextension (on stability ball)",
  "barbell bench press",
  "barbell decline bench press",
  "barbell incline bench press",
  "cable bench press",
  "cable incline bench press",
  "cable decline fly",
  "cable incline fly",
  "cable standing fly",
  "chest dip (on dip-pull-up cage)",
  "decline push-up",
  "dumbbell bench press",
  "dumbbell decline bench press",
  "dumbbell decline fly",
  "dumbbell fly",
  "dumbbell incline bench press",
  "dumbbell incline fly",
  "incline push-up",
  "lever chest press",
  "lever decline chest press",
  "lever incline chest press",
  "lever seated fly",
  "push-up",
  "band front raise",
  "band reverse fly",
  "band shoulder press",
  "barbell front raise",
  "barbell seated overhead press",
  "barbell standing wide military press",
  "cable front raise",
  "cable lateral raise",
  "cable one arm lateral raise",
  "cable shoulder press",
  "dumbbell arnold press",
  "dumbbell front raise",
  "dumbbell lateral raise",
  "dumbbell one arm shoulder press",
  "dumbbell rear delt raise",
  "dumbbell reverse fly",
  "dumbbell seated lateral raise",
  "dumbbell seated shoulder press",
  "dumbbell standing overhead press",
  "lever lateral raise",
  "lever military press",
  "lever seated reverse fly",
  "lever shoulder press",
  "smith seated shoulder press",
  "smith shoulder press",
  "barbell curl",
  "barbell preacher curl",
  "barbell reverse curl",
  "cable curl",
  "cable hammer curl (with rope)",
  "cable preacher curl",
  "dumbbell alternate biceps curl",
  "dumbbell biceps curl",
  "dumbbell concentration curl",
  "dumbbell hammer curl",
  "dumbbell incline biceps curl",
  "dumbbell preacher curl",
  "dumbbell seated bicep curl",
  "dumbbell standing biceps curl",
  "assisted triceps dip (kneeling)",
  "barbell close-grip bench press",
  "barbell lying triceps extension",
  "barbell seated overhead triceps extension",
  "barbell standing overhead triceps extension",
  "cable overhead triceps extension (rope attachment)",
  "cable pushdown",
  "cable pushdown (with rope attachment)",
  "cable reverse-grip pushdown",
  "cable triceps pushdown (v-bar)",
  "dumbbell lying triceps extension",
  "dumbbell seated triceps extension",
  "dumbbell standing triceps extension",
  "lever triceps extension",
  "triceps dip",
  "band squat",
  "barbell deadlift",
  "barbell front squat",
  "barbell full squat",
  "barbell glute bridge",
  "barbell high bar squat",
  "barbell lunge",
  "barbell romanian deadlift",
  "barbell sumo deadlift",
  "dumbbell deadlift",
  "dumbbell goblet squat",
  "dumbbell lunge",
  "dumbbell romanian deadlift",
  "dumbbell squat",
  "kettlebell front squat",
  "kettlebell goblet squat",
  "lever alternate leg press",
  "lever horizontal one leg press",
  "lever leg extension",
  "low glute bridge on floor",
  "resistance band leg extension",
  "sled 45° leg press",
  "smith full squat",
  "smith leg press",
  "split squats",
  "walking lunge",
  "barbell good morning",
  "barbell straight leg deadlift",
  "glute-ham raise",
  "inverse leg curl (bench support)",
  "lever kneeling leg curl",
  "lever lying leg curl",
  "lever seated leg curl",
  "standing single leg curl",
  "cable hip adduction",
  "lever seated hip adduction",
  "3/4 sit-up",
  "cable kneeling crunch",
  "cable seated crunch",
  "cable standing crunch",
  "cross body crunch",
  "decline crunch",
  "decline sit-up",
  "front plank",
  "hanging leg raise",
  "hanging straight leg raise",
  "lever seated crunch",
  "lying leg raise flat bench",
  "reverse crunch",
  "russian twist",
  "seated leg raise",
  "side plank",
  "weighted crunch",
  "weighted front plank",
  "weighted russian twist",
]);

const EXCLUDED_NAME_SIGNALS = [
  /female/iu,
  /male/iu,
  /version/iu,
  /with towel/iu,
  /self assisted/iu,
  /partner/iu,
  /plyometric/iu,
  /jump/iu,
  /finger/iu,
  /wrist/iu,
  /neck/iu,
  /wheel run/iu,
  /power point/iu,
  /impossible dips/iu,
  /muscle-up/iu,
  /handstand/iu,
  /\bjerk\b/iu,
  /suspended/iu,
  /\bv\. ?[0-9]+\b/iu,
  /pov/iu,
  /potty/iu,
  /spider crawl/iu,
  /inside leg kick/iu,
  /outside leg kick/iu,
  /pike-to-cobra/iu,
  /two-one/iu,
  /rocky/iu,
  /elbow lift/iu,
  /squatting row/iu,
  /squat row/iu,
  /curl squat/iu,
  /lunge with.*curl/iu,
  /lunge.*extension/iu,
  /side plank.*(?:fly|adduction)/iu,
  /bosu ball/iu,
];

const GLOBAL_QUERY_ALIASES = Object.freeze({
  pecho: ["chest", "pectorals", "pectoral"],
  espalda: ["back", "lats", "upper back", "latissimus dorsi"],
  hombro: ["shoulders", "delts", "deltoids"],
  hombros: ["shoulders", "delts", "deltoids"],
  bíceps: ["biceps", "biceps curl"],
  biceps: ["biceps", "biceps curl"],
  tríceps: ["triceps", "triceps extension"],
  triceps: ["triceps", "triceps extension"],
  piernas: ["upper legs", "lower legs", "quads", "hamstrings", "glutes", "calves"],
  cuádriceps: ["quads", "quadriceps"],
  cuadriceps: ["quads", "quadriceps"],
  isquiotibiales: ["hamstrings"],
  glúteos: ["glutes"],
  gluteos: ["glutes"],
  gemelos: ["calves"],
  pantorrillas: ["calves"],
  abdomen: ["abs", "waist", "core"],
  abdominales: ["abs", "waist", "core"],
  mancuernas: ["dumbbell"],
  mancuerna: ["dumbbell"],
  barra: ["barbell", "ez barbell", "olympic barbell"],
  banco: ["bench"],
  banco_predicador: ["preacher_bench"],
  banco_hiperextension: ["hyperextension_bench"],
  barra_dominadas: ["pull_up_bar", "pull-up bar"],
  rack_barra: ["barbell_rack"],
  anclaje_banda: ["band_anchor"],
  maquina_glute_ham: ["glute_ham_developer"],
  plataforma: ["step_platform"],
  paralelas: ["dip_bars", "dip bars"],
  polea: ["cable"],
  máquina: ["machine", "leverage machine", "smith machine", "assisted"],
  maquina: ["machine", "leverage machine", "smith machine", "assisted"],
  banda: ["resistance_band", "band", "resistance band"],
  corporal: ["body_weight", "body weight"],
  peso_corporal: ["body_weight", "body weight"],
});

const SPANISH_NAME_OVERRIDES = Object.freeze({
  "3/4 sit-up": "Abdominal de tres cuartos",
  "assisted triceps dip (kneeling)": "Fondo de tríceps asistido de rodillas",
  "assisted pull-up": "Dominada asistida",
  "band assisted pull-up": "Dominada asistida con banda",
  "bodyweight standing calf raise":
    "Elevación de talones de pie con peso corporal",
  "back extension on exercise ball": "Extensión lumbar con pelota de estabilidad",
  "barbell pendlay row": "Remo Pendlay con barra",
  "barbell bent over row": "Remo inclinado con barra",
  "barbell incline row": "Remo con barra apoyado en banco inclinado",
  "cable low seated row": "Remo sentado bajo en polea",
  "cable straight arm pulldown": "Jalón con brazos rectos en polea",
  "reverse grip machine lat pulldown": "Jalón dorsal en máquina con agarre supino",
  "wide grip pull-up": "Dominada con agarre amplio",
  "chest dip (on dip-pull-up cage)": "Fondo de pecho en paralelas",
  "barbell standing wide military press": "Press militar de pie con barra y agarre amplio",
  "barbell front raise": "Elevación frontal con barra",
  "barbell front squat": "Sentadilla frontal con barra",
  "barbell lying triceps extension": "Extensión de tríceps acostado con barra",
  "barbell overhead squat": "Sentadilla sobre la cabeza con barra",
  "barbell reverse curl": "Curl inverso con barra",
  "barbell seated calf raise": "Elevación de talones sentado con barra",
  "barbell seated overhead triceps extension":
    "Extensión de tríceps sobre la cabeza sentado con barra",
  "barbell standing overhead triceps extension":
    "Extensión de tríceps sobre la cabeza de pie con barra",
  "barbell sumo deadlift": "Peso muerto sumo con barra",
  "barbell wide squat": "Sentadilla con postura amplia con barra",
  "barbell wide stance squat": "Sentadilla con postura amplia con barra",
  "cable bench press": "Press de pecho de pie en polea",
  "cable front raise": "Elevación frontal en polea",
  "cable decline fly": "Apertura declinada en polea",
  "cable incline fly": "Apertura inclinada en polea",
  "cable kneeling crunch": "Encogimiento abdominal de rodillas en polea",
  "cable one arm lateral raise": "Elevación lateral a un brazo en polea",
  "cable reverse-grip pushdown":
    "Extensión de tríceps en polea con agarre inverso",
  "cable seated crunch": "Encogimiento abdominal sentado en polea",
  "cable side crunch": "Encogimiento abdominal lateral en polea",
  "cable standing crunch": "Encogimiento abdominal de pie en polea",
  "cable standing fly": "Apertura de pie en polea",
  "cable triceps pushdown (v-bar)": "Extensión de tríceps en polea con barra V",
  "cross body crunch": "Encogimiento abdominal cruzado",
  "decline crunch": "Encogimiento abdominal en banco declinado",
  "decline push-up": "Flexión con pies elevados",
  "decline sit-up": "Abdominal en banco declinado",
  "dumbbell decline fly": "Apertura declinada con mancuernas",
  "dumbbell incline biceps curl": "Curl de bíceps inclinado con mancuernas",
  "dumbbell incline fly": "Apertura inclinada con mancuernas",
  "dumbbell front raise": "Elevación frontal con mancuernas",
  "dumbbell lying triceps extension":
    "Extensión de tríceps acostado con mancuernas",
  "dumbbell seated lateral raise": "Elevación lateral sentado con mancuernas",
  "dumbbell standing biceps curl": "Curl de bíceps de pie con mancuernas",
  "dumbbell standing calf raise": "Elevación de talones de pie con mancuernas",
  "dumbbell standing triceps extension":
    "Extensión de tríceps de pie con mancuernas",
  "cable side bend crunch (bosu ball)": "Encogimiento lateral en polea sobre BOSU",
  "cable tuck reverse crunch": "Encogimiento inverso en polea con rodillas flexionadas",
  "inverse leg curl (bench support)": "Curl femoral nórdico con apoyo de banco",
  "inverse leg curl (on pull-up cable machine)": "Curl femoral nórdico con apoyo de máquina",
  "cable assisted inverse leg curl": "Curl femoral nórdico asistido en polea",
  "lever horizontal one leg press": "Prensa horizontal a una pierna en máquina",
  "lever alternate leg press": "Prensa alternada de piernas en máquina",
  "dumbbell supported squat": "Sentadilla asistida con mancuernas",
  "dumbbell bent over row": "Remo inclinado con mancuernas",
  "dumbbell incline row": "Remo con mancuernas apoyado en banco inclinado",
  "standing single leg curl": "Curl femoral de pie a una pierna",
  "barbell standing leg calf raise": "Elevación de talones de pie con barra",
  "barbell bench front squat": "Sentadilla frontal al banco con barra",
  "barbell bench squat": "Sentadilla al banco con barra",
  "barbell side split squat": "Sentadilla búlgara lateral con barra",
  "glute-ham raise": "Elevación de glúteos e isquiotibiales",
  "lever seated leg raise crunch": "Encogimiento abdominal con elevación de piernas en máquina",
  "lying leg raise flat bench": "Elevación de piernas acostado en banco plano",
  "dumbbell single arm overhead carry": "Transporte sobre la cabeza a un brazo con mancuerna",
  "farmers walk": "Paseo del granjero con mancuernas",
  "kettlebell goblet squat": "Sentadilla goblet con kettlebell",
  "kettlebell one arm floor press": "Press de suelo a un brazo con kettlebell",
  "kettlebell one arm row": "Remo a un brazo con kettlebell",
  "kettlebell seated press": "Press sentado con kettlebell",
  "kettlebell swing": "Balanceo con kettlebell",
  "hanging leg raise": "Elevación de piernas colgado",
  "incline push-up": "Flexión de brazos inclinada",
  "inverted row": "Remo invertido",
  "kettlebell front squat": "Sentadilla frontal con kettlebell",
  "lever front pulldown": "Jalón frontal en máquina",
  "lever kneeling leg curl": "Curl femoral de rodillas en máquina",
  "lever lying leg curl": "Curl femoral acostado en máquina",
  "lever seated calf raise": "Elevación de talones sentado en máquina",
  "lever seated crunch (chest pad)":
    "Encogimiento abdominal sentado en máquina con apoyo pectoral",
  "lever seated fly": "Apertura de pecho sentada en máquina",
  "lever seated hip adduction": "Aducción de cadera sentada en máquina",
  "lever seated leg curl": "Curl femoral sentado en máquina",
  "lever seated reverse fly": "Vuelo posterior sentado en máquina",
  "lever standing calf raise": "Elevación de talones de pie en máquina",
  "lever t bar row": "Remo en barra T en máquina",
  "low glute bridge on floor": "Puente de glúteos en el suelo",
  "weighted crunch": "Encogimiento abdominal lastrado",
  "weighted pull-up": "Dominada lastrada",
  "weighted russian twist": "Giro ruso lastrado",
  "reverse crunch": "Encogimiento abdominal inverso",
  "cable reverse crunch": "Encogimiento abdominal inverso en polea",
  "seated leg raise": "Elevación de piernas sentado",
  "band front raise": "Elevación frontal con banda",
  "barbell standing calf raise": "Elevación de talones de pie con barra",
  "cable standing calf raise": "Elevación de talones de pie en polea",
  "dumbbell seated calf raise": "Elevación de talones sentado con mancuerna",
  "walking lunge": "Zancada caminando",
  "split squats": "Sentadilla dividida",
  "weighted front plank": "Plancha frontal lastrada",
  "front plank with twist": "Plancha frontal con giro",
  "dumbbell seated triceps extension":
    "Extensión de tríceps sentado con mancuerna",
  "resistance band leg extension": "Extensión de piernas con banda de resistencia",
  "push-up (wall)": "Flexión de brazos contra la pared",
  "triceps dip": "Fondo de tríceps en banco",
});

function scoreCandidate(record) {
  const name = record.name.toLocaleLowerCase("en");
  let score = PREFERRED_EXACT_NAMES.has(name) ? 1_500 : 0;
  score += STANDARD_NAME_SIGNALS.some((signal) => signal.test(name)) ? 500 : 0;
  let commonScore = 0;
  for (const [index, signal] of COMMON_NAME_SIGNALS.entries()) {
    if (signal.test(name)) commonScore = Math.max(commonScore, 200 - index);
  }
  score += commonScore;
  if (["dumbbell", "barbell", "body weight", "cable", "leverage machine"].includes(record.equipment)) {
    score += 35;
  }
  if (name.length <= 36) score += 20;
  if (name.length > 55) score -= 30;
  if (/one arm|single arm|one leg|single leg|alternate|alternating/iu.test(name)) score -= 5;
  if (/incline|decline|seated|standing|lying/iu.test(name)) score += 3;
  if (/ with | to | and |cross-over|twist|rotation|around|on /iu.test(name)) score -= 45;
  return score;
}

function selectCuratedRecords(records) {
  const selected = [];
  const selectedNames = new Set();
  for (const [bodyPart, targetQuotas] of Object.entries(TARGET_QUOTAS)) {
    for (const [target, quota] of Object.entries(targetQuotas)) {
      const candidates = records
        .filter(
          (record) =>
            record.body_part === bodyPart &&
            record.target === target &&
            ALLOWED_EQUIPMENT.has(record.equipment) &&
            !EXCLUDED_NAME_SIGNALS.some((signal) => signal.test(record.name)),
        )
        .sort((left, right) => {
          const scoreDifference = scoreCandidate(right) - scoreCandidate(left);
          return scoreDifference || left.id.localeCompare(right.id);
        });
      if (candidates.length < quota) {
        throw new Error(`Only ${candidates.length} candidates found for ${bodyPart}/${target}; need ${quota}.`);
      }
      let added = 0;
      const equipmentCounts = new Map();
      const equipmentCap = Math.max(3, Math.ceil(quota * 0.4));
      for (const candidate of candidates) {
        const normalizedName = candidate.name.toLocaleLowerCase("en").trim();
        if (selectedNames.has(normalizedName)) continue;
        if ((equipmentCounts.get(candidate.equipment) ?? 0) >= equipmentCap) continue;
        selected.push(candidate);
        selectedNames.add(normalizedName);
        equipmentCounts.set(candidate.equipment, (equipmentCounts.get(candidate.equipment) ?? 0) + 1);
        added += 1;
        if (added === quota) break;
      }
      if (added < quota) {
        for (const candidate of candidates) {
          const normalizedName = candidate.name.toLocaleLowerCase("en").trim();
          if (selectedNames.has(normalizedName)) continue;
          selected.push(candidate);
          selectedNames.add(normalizedName);
          added += 1;
          if (added === quota) break;
        }
      }
      if (added < quota) {
        throw new Error(`Only ${added} unique candidates found for ${bodyPart}/${target}; need ${quota}.`);
      }
    }
  }
  for (const requiredName of MANDATORY_ADDITIONS) {
    const candidate = records.find(
      (record) => record.name.toLocaleLowerCase("en") === requiredName,
    );
    if (!candidate) throw new Error(`Mandatory curated exercise is missing: ${requiredName}.`);
    if (!selectedNames.has(requiredName)) {
      selected.push(candidate);
      selectedNames.add(requiredName);
    }
  }
  return selected
    .filter((record) => !CURATION_EXCLUDED_IDS.has(record.id))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function translateExerciseName(sourceName) {
  if (SPANISH_NAME_OVERRIDES[sourceName]) return SPANISH_NAME_OVERRIDES[sourceName];
  let value = sourceName.toLocaleLowerCase("en");
  const replacements = [
    [/reverse fly/gu, "vuelo posterior"],
    [/rear delt raise/gu, "elevación de deltoides posterior"],
    [/triceps dip/gu, "fondo de tríceps"],
    [/chest dip/gu, "fondo de pecho"],
    [/straight leg deadlift/gu, "peso muerto con piernas rígidas"],
    [/stiff leg deadlift/gu, "peso muerto con piernas rígidas"],
    [/romanian deadlift/gu, "peso muerto rumano"],
    [/close-grip bench press/gu, "press de banca con agarre cerrado"],
    [/overhead triceps extension/gu, "extensión de tríceps sobre la cabeza"],
    [/standing overhead press/gu, "press sobre la cabeza de pie"],
    [/seated shoulder press/gu, "press de hombros sentado"],
    [/one arm shoulder press/gu, "press de hombros a un brazo"],
    [/front plank/gu, "plancha frontal"],
    [/side plank/gu, "plancha lateral"],
    [/ez barbell/gu, "con barra EZ"],
    [/barbell/gu, "con barra"],
    [/dumbbell/gu, "con mancuernas"],
    [/ez bar/gu, "con barra EZ"],
    [/cable/gu, "en polea"],
    [/lever/gu, "en máquina"],
    [/smith/gu, "en Smith"],
    [/band/gu, "con banda"],
    [/resistance/gu, "de resistencia"],
    [/kettlebell/gu, "con kettlebell"],
    [/weighted/gu, "lastrado"],
    [/assisted/gu, "asistido"],
    [/stability ball/gu, "con pelota de estabilidad"],
    [/incline/gu, "inclinado"],
    [/decline/gu, "declinado"],
    [/flat/gu, "plano"],
    [/seated/gu, "sentado"],
    [/standing/gu, "de pie"],
    [/lying/gu, "acostado"],
    [/bent over/gu, "inclinado"],
    [/rear/gu, "posterior"],
    [/reverse/gu, "inverso"],
    [/single arm/gu, "a un brazo"],
    [/one arm/gu, "a un brazo"],
    [/single leg/gu, "a una pierna"],
    [/one leg/gu, "a una pierna"],
    [/alternating/gu, "alternado"],
    [/alternate/gu, "alternado"],
    [/bench press/gu, "press de banca"],
    [/chest press/gu, "press de pecho"],
    [/shoulder press/gu, "press de hombros"],
    [/military press/gu, "press militar"],
    [/push-up/gu, "flexión de brazos"],
    [/push up/gu, "flexión de brazos"],
    [/pull-up/gu, "dominada"],
    [/chin-up/gu, "dominada supina"],
    [/pulldown/gu, "jalón"],
    [/pull down/gu, "jalón"],
    [/straight arm/gu, "con brazos rectos"],
    [/biceps curl/gu, "curl de bíceps"],
    [/hammer curl/gu, "curl martillo"],
    [/preacher curl/gu, "curl predicador"],
    [/concentration curl/gu, "curl concentrado"],
    [/triceps extension/gu, "extensión de tríceps"],
    [/tricep extension/gu, "extensión de tríceps"],
    [/pushdown/gu, "extensión de tríceps hacia abajo"],
    [/skull crusher/gu, "rompecráneos"],
    [/lateral raise/gu, "elevación lateral"],
    [/front raise/gu, "elevación frontal"],
    [/reverse fly/gu, "vuelo posterior"],
    [/chest fly/gu, "apertura de pecho"],
    [/\bfly\b/gu, "apertura"],
    [/face pull/gu, "tirón a la cara"],
    [/shrug/gu, "encogimiento de hombros"],
    [/deadlift/gu, "peso muerto"],
    [/romanian/gu, "rumano"],
    [/stiff leg/gu, "con piernas rígidas"],
    [/good morning/gu, "buen día"],
    [/hip thrust/gu, "empuje de cadera"],
    [/glute bridge/gu, "puente de glúteos"],
    [/pull through/gu, "tirón entre piernas"],
    [/back extension/gu, "extensión lumbar"],
    [/hyperextension/gu, "hiperextensión"],
    [/leg press/gu, "prensa de piernas"],
    [/leg extension/gu, "extensión de piernas"],
    [/leg curl/gu, "curl femoral"],
    [/calf raise/gu, "elevación de talones"],
    [/split squat/gu, "sentadilla búlgara"],
    [/hack squat/gu, "sentadilla hack"],
    [/goblet squat/gu, "sentadilla goblet"],
    [/\bsquat\b/gu, "sentadilla"],
    [/\blunge\b/gu, "zancada"],
    [/step-up/gu, "subida al banco"],
    [/\brow\b/gu, "remo"],
    [/\bdip\b/gu, "fondo"],
    [/\bplank\b/gu, "plancha"],
    [/\bcrunch\b/gu, "encogimiento abdominal"],
    [/sit-up/gu, "abdominal"],
    [/leg raise/gu, "elevación de piernas"],
    [/knee raise/gu, "elevación de rodillas"],
    [/russian twist/gu, "giro ruso"],
    [/rollout/gu, "despliegue abdominal"],
    [/bodyweight/gu, "con peso corporal"],
    [/exercise ball/gu, "pelota de estabilidad"],
    [/bosu ball/gu, "BOSU"],
    [/inverse/gu, "inverso"],
    [/supported/gu, "asistido"],
    [/support/gu, "apoyo"],
    [/machine/gu, "máquina"],
    [/side bend/gu, "flexión lateral"],
    [/\blow\b/gu, "bajo"],
    [/\bleg\b/gu, "pierna"],
    [/kneeling/gu, "de rodillas"],
    [/overhead/gu, "sobre la cabeza"],
    [/wide-grip/gu, "con agarre amplio"],
    [/wide grip/gu, "con agarre amplio"],
    [/close-grip/gu, "con agarre cerrado"],
    [/reverse grip/gu, "con agarre inverso"],
    [/hip adduction/gu, "aducción de cadera"],
    [/glute-ham raise/gu, "elevación de glúteos e isquiotibiales"],
    [/t bar/gu, "en barra T"],
    [/straight leg/gu, "con piernas rígidas"],
    [/walking/gu, "caminando"],
    [/hanging/gu, "colgado"],
    [/cross body/gu, "cruzado"],
    [/chest pad/gu, "apoyo pectoral"],
    [/rope attachment/gu, "accesorio de cuerda"],
    [/with rope/gu, "con cuerda"],
    [/on bench/gu, "en banco"],
    [/flat bench/gu, "banco plano"],
    [/bench/gu, "banco"],
    [/floor/gu, "suelo"],
    [/front/gu, "frontal"],
    [/side/gu, "lateral"],
    [/wide/gu, "amplio"],
    [/grip/gu, "agarre"],
    [/with/gu, "con"],
    [/\bon\b/gu, "en"],
    [/close grip/gu, "con agarre cerrado"],
    [/wide grip/gu, "con agarre amplio"],
    [/neutral grip/gu, "con agarre neutro"],
    [/underhand/gu, "con agarre supino"],
    [/overhand/gu, "con agarre prono"],
    [/upper/gu, "superior"],
    [/lower/gu, "inferior"],
  ];
  for (const [pattern, replacement] of replacements) value = value.replace(pattern, replacement);
  value = normalizeText(value.replace(/[()]/gu, " ").replace(/\s+-\s+/gu, " "));
  for (const [prefix, suffix] of [
    ["con barra ", " con barra"],
    ["con mancuernas ", " con mancuernas"],
    ["en polea ", " en polea"],
    ["en máquina ", " en máquina"],
    ["en Smith ", " en Smith"],
    ["con banda ", " con banda"],
    ["con kettlebell ", " con kettlebell"],
  ]) {
    if (value.startsWith(prefix)) value = `${value.slice(prefix.length)}${suffix}`;
  }
  value = value
    .replace(/^(inclinado|declinado) (press de (?:banca|pecho|hombros))/u, "$2 $1")
    .replace(/^(sentado|acostado|de pie) (curl|press|remo|encogimiento)/u, "$2 $1");
  return value.charAt(0).toLocaleUpperCase("es") + value.slice(1);
}

function inferMovementPattern(record) {
  const name = record.name.toLocaleLowerCase("en").replace(/\([^)]*\)/gu, "");
  if (/straight arm pulldown|\bpullover\b/iu.test(name)) return "isolation";
  if (/lunge|split squat|step-up/iu.test(name)) return "lunge";
  if (/carry|farmer|walk/iu.test(name)) return "carry";
  if (/deadlift|good morning|hip thrust|glute bridge|glute-ham raise|pull through|back extension|hyperextension|swing/iu.test(name)) {
    return "hinge";
  }
  if (/squat|leg press/iu.test(name)) return "squat";
  if (/reverse fly|rear fly|face pull|\brow\b/iu.test(name)) return "horizontal_pull";
  if (/bench press|chest press|floor press|push-up|push up|\bfly\b|\bdip\b/iu.test(name)) {
    return "horizontal_push";
  }
  if (/pull-up|chin-up|pulldown|pull down/iu.test(name)) return "vertical_pull";
  if (/shoulder press|military press|overhead press|arnold press|seated press/iu.test(name)) {
    return "vertical_push";
  }
  if (/plank|crunch|sit-up|leg raise|knee raise|twist|rollout|abdominal/iu.test(name)) {
    return "core";
  }
  return "isolation";
}

function inferModality(record, movementPattern) {
  if (
    movementPattern !== "isolation" &&
    movementPattern !== "core" &&
    !/\bfly\b|reverse fly|face pull/iu.test(record.name)
  ) {
    return "compound";
  }
  return "isolation";
}

function inferLaterality(record) {
  if (["0168", "0223", "0262", "0297", "3007"].includes(record.id)) {
    return "unilateral";
  }
  return /single arm|one arm|single leg|one leg|unilateral|split squat|lunge|step-up|alternat/iu.test(
    record.name,
  )
    ? "unilateral"
    : "bilateral";
}

function inferSkill(record, movementPattern) {
  if (/pistol|dragon|suspended|ring|power clean|snatch/iu.test(record.name)) return "high";
  if (
    ["hinge", "squat", "lunge", "vertical_pull"].includes(movementPattern) &&
    ["barbell", "body weight", "kettlebell"].includes(record.equipment)
  ) {
    return "medium";
  }
  if (["leverage machine", "cable", "assisted"].includes(record.equipment)) return "low";
  return movementPattern === "isolation" || movementPattern === "core" ? "low" : "medium";
}

function inferDifficulty(record, skillRequirement) {
  if (skillRequirement === "high") return "advanced";
  if (
    skillRequirement === "low" ||
    ["leverage machine", "assisted", "cable"].includes(record.equipment)
  ) {
    return "beginner";
  }
  return "intermediate";
}

function inferFatigue(record, movementPattern, modality) {
  if (/deadlift|\bbarbell\b.*\bsquat\b|leg press/iu.test(record.name)) return "high";
  if (modality === "compound" || ["hinge", "squat", "lunge"].includes(movementPattern)) {
    return "medium";
  }
  return "low";
}

function inferSubstitutionGroup(record, movementPattern, modality) {
  if (movementPattern === "carry") return "carry:loaded_carry";
  const name = record.name.toLocaleLowerCase("en");
  const target = record.target.replaceAll(" ", "_");
  if (movementPattern === "core") {
    if (/twist|side|lateral|cross body/iu.test(name)) {
      return "core:rotation_lateral";
    }
    if (/plank|rollout/iu.test(name)) return "core:anti_extension";
    if (/leg raise|knee raise|reverse crunch/iu.test(name)) return "core:hip_flexion";
    return "core:flexion";
  }
  if (movementPattern === "isolation") {
    if (target === "delts" && /front raise/iu.test(name)) return "isolation:delts_front";
    if (target === "delts" && /lateral raise/iu.test(name)) {
      return "isolation:delts_lateral";
    }
    return `isolation:${target}`;
  }
  if (movementPattern === "horizontal_push" && modality === "isolation") {
    return `chest_fly:${target}`;
  }
  if (movementPattern === "horizontal_pull" && modality === "isolation") {
    return `rear_delt_pull:${target}`;
  }
  if (movementPattern === "horizontal_pull") return `row:${target}`;
  if (movementPattern === "vertical_pull") return `vertical_pull:${target}`;
  return `${movementPattern}:${record.body_part.replaceAll(" ", "_")}`;
}

const ADDITIONAL_EQUIPMENT_OVERRIDES = Object.freeze({
  "0025": ["barbell_rack", "bench"],
  "0030": ["barbell_rack", "bench"],
  "0033": ["barbell_rack", "bench"],
  "0042": ["barbell_rack"],
  "0047": ["barbell_rack", "bench"],
  "0054": ["barbell_rack"],
  "0070": ["preacher_bench"],
  "0108": ["barbell_rack"],
  "0124": ["barbell_rack"],
  "0195": ["preacher_bench"],
  "0279": ["bench"],
  "0372": ["preacher_bench"],
  "0488": ["hyperextension_bench"],
  "0493": ["bench"],
  "0766": ["bench", "smith_machine"],
  "0814": ["bench"],
  "0993": ["band_anchor"],
  "1379": ["bench", "step_platform"],
  "2812": ["step_platform"],
  "3007": ["band_anchor"],
  "3193": ["glute_ham_developer"],
});

function inferAdditionalEquipment(record) {
  const name = record.name.toLocaleLowerCase("en");
  const instructions = record.instruction_steps.en.join(" ").toLocaleLowerCase("en");
  const additional = new Set();
  if (/preacher bench/iu.test(instructions)) {
    additional.add("preacher_bench");
  } else if (/\bbench\b/iu.test(instructions)) {
    additional.add("bench");
  }
  if (/raised (?:platform|step)|block or step|bench or step/iu.test(instructions)) {
    additional.add("step_platform");
  }
  if (/\b(?:squat )?rack\b/iu.test(instructions) && record.equipment === "barbell") {
    additional.add("barbell_rack");
  }
  if (
    /pull-up bar/iu.test(instructions) &&
    !/\bdip\b/iu.test(name) &&
    ["body weight", "band", "resistance band", "weighted"].includes(record.equipment)
  ) {
    additional.add("pull_up_bar");
  }
  if (/\bdip\b/iu.test(name) && ["body weight", "weighted"].includes(record.equipment)) {
    additional.add("dip_bars");
  }
  if (/exercise ball|stability ball/iu.test(name) && record.equipment !== "stability ball") {
    additional.add("stability_ball");
  }
  if (/cable machine/iu.test(instructions) && record.equipment === "body weight") {
    additional.add("cable");
  } else if (/\bmachine\b/iu.test(instructions) && record.equipment === "body weight") {
    additional.add("machine");
  }
  return [...(ADDITIONAL_EQUIPMENT_OVERRIDES[record.id] ?? additional)].sort();
}

const METADATA_OVERRIDES = Object.freeze({
  "0032": { defaultRepRange: [3, 8] },
  "0117": { defaultRepRange: [3, 8] },
  "0472": { difficulty: "intermediate", skillRequirement: "medium" },
  "0493": { difficulty: "beginner", skillRequirement: "low" },
  "0534": { difficulty: "beginner", skillRequirement: "medium" },
  "0549": { defaultRepRange: [10, 20], defaultRestSeconds: [60, 120] },
  "0841": {
    difficulty: "advanced",
    fatigueCost: "high",
    skillRequirement: "high",
    defaultRepRange: [3, 8],
    defaultRestSeconds: [120, 180],
  },
  "0970": { difficulty: "beginner", skillRequirement: "medium" },
  "1004": { difficulty: "beginner", skillRequirement: "low" },
  "0659": { difficulty: "beginner", skillRequirement: "low" },
  "3013": { difficulty: "beginner", skillRequirement: "low" },
  "3193": {
    difficulty: "advanced",
    fatigueCost: "medium",
    skillRequirement: "high",
    defaultRepRange: [6, 12],
    defaultRestSeconds: [75, 120],
  },
});

function createMetadata(record) {
  const normalized = normalizeExercise(record);
  const movementPattern = inferMovementPattern(record);
  const modality = inferModality(record, movementPattern);
  const laterality = inferLaterality(record);
  const skillRequirement = inferSkill(record, movementPattern);
  const fatigueCost = inferFatigue(record, movementPattern, modality);
  const defaultRepRange =
    movementPattern === "core" ? [10, 20] : modality === "compound" ? [6, 12] : [10, 15];
  const defaultRestSeconds =
    fatigueCost === "high" ? [120, 180] : modality === "compound" ? [75, 120] : [45, 75];
  const additionalEquipment = inferAdditionalEquipment(record);

  return {
    exerciseId: record.id,
    approvedForGeneration: true,
    difficulty: inferDifficulty(record, skillRequirement),
    movementPattern,
    modality,
    laterality,
    defaultRepRange,
    defaultRestSeconds,
    fatigueCost,
    skillRequirement,
    substitutionGroup: inferSubstitutionGroup(record, movementPattern, modality),
    additionalEquipment,
    tags: [...new Set([
      normalized.bodyPart,
      normalized.equipment,
      normalized.rawEquipment.replaceAll(" ", "_"),
      ...normalized.primaryMuscles,
      ...normalized.secondaryMuscles,
      movementPattern,
      modality,
      laterality,
      ...additionalEquipment,
    ])].sort(),
    curation: {
      method: "deterministic_rules_v1_with_selection_review",
      programmingAssumptionsRequireDomainReview: true,
    },
    ...(METADATA_OVERRIDES[record.id] ?? {}),
  };
}

async function atomicJson(targetPath, value) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await rm(targetPath, { force: true });
  await rename(temporaryPath, targetPath);
}

async function ensureManualCuratedDocument(targetPath, initialValue) {
  try {
    const existing = parseJsonBuffer(await readFile(targetPath), targetPath);
    if (existing.datasetCommit !== DATASET_SOURCE.commit) {
      throw new Error(
        `Manual curated document ${targetPath} is pinned to another dataset commit.`,
      );
    }
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      await atomicJson(targetPath, initialValue);
      return;
    }
    throw error;
  }
}

const records = parseJsonBuffer(
  await readFile(path.join(projectRoot, SOURCE_DIRECTORY, "exercises.json")),
  "vendored exercises.json",
);
const selected = selectCuratedRecords(records);
const names = Object.fromEntries(selected.map((record) => [record.id, translateExerciseName(record.name)]));
const metadata = selected.map(createMetadata);
const exerciseAliases = Object.fromEntries(
  selected.map((record) => [
    record.id,
    [...new Set([
      record.name.toLocaleLowerCase("en"),
      names[record.id].toLocaleLowerCase("es"),
      record.target,
      record.muscle_group,
    ])].sort(),
  ]),
);
const excludedRecords = records
  .filter(
    (record) => record.body_part === "neck" || CURATION_EXCLUDED_IDS.has(record.id),
  )
  .map((record) => ({
    exerciseId: record.id,
    reason:
      CURATION_EXCLUSION_REASONS[record.id] ??
      "Loaded cervical exercise requires explicit domain and safety review before generation.",
  }));
const curationReviewSha256 = curationReviewDigest({
  records: metadata,
  names,
  exclusions: excludedRecords,
});
if (curationReviewSha256 !== DATASET_SOURCE.expected.curationReviewSha256) {
  throw new Error(
    `Curated review digest changed: expected ${DATASET_SOURCE.expected.curationReviewSha256}, received ${curationReviewSha256}. Review the affected records before updating the pin.`,
  );
}

const outputRoot = path.join(projectRoot, CURATED_DIRECTORY);
await atomicJson(path.join(outputRoot, "exercise-display-names.es.json"), {
  schemaVersion: 1,
  datasetCommit: DATASET_SOURCE.commit,
  curationReviewSha256,
  generatedTranslationPolicy: "rules_v1_pending_language_review",
  names,
});
await atomicJson(path.join(outputRoot, "exercise-metadata.json"), {
  schemaVersion: 1,
  datasetCommit: DATASET_SOURCE.commit,
  curationReviewSha256,
  approvedCount: metadata.length,
  records: metadata,
});
await atomicJson(path.join(outputRoot, "exercise-aliases.json"), {
  schemaVersion: 1,
  datasetCommit: DATASET_SOURCE.commit,
  queryAliases: GLOBAL_QUERY_ALIASES,
  exerciseAliases,
});
await atomicJson(path.join(outputRoot, "exercise-exclusions.json"), {
  schemaVersion: 1,
  datasetCommit: DATASET_SOURCE.commit,
  curationReviewSha256,
  records: excludedRecords,
});
await ensureManualCuratedDocument(path.join(outputRoot, "exercise-media-overrides.json"), {
  schemaVersion: 1,
  datasetCommit: DATASET_SOURCE.commit,
  overrides: {},
});

console.log(`Generated explicit curation for ${selected.length} common exercises.`);
