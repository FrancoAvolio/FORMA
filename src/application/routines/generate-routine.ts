import {
  generateRoutine,
  type GenerateRoutineInput,
  type RoutineGenerationResult,
} from "../../domain/routine/engine/generate-routine";

/** Application entry point shared by the guided form and interpreted chat path. */
export function generateRoutineUseCase(
  input: GenerateRoutineInput,
): RoutineGenerationResult {
  return generateRoutine(input);
}

