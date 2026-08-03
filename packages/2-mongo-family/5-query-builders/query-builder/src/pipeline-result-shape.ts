import type {
  MongoAggExpr,
  MongoFieldShape,
  MongoPipelineStage,
  MongoResultShape,
} from '@internal/mongo-query-ast/execution';
import {
  freezeMongoResultShape,
  MongoAddFieldsStage,
  MongoAggFieldRef,
  MongoProjectStage,
} from '@internal/mongo-query-ast/execution';

const identityStageKinds = new Set(['match', 'sort', 'limit', 'skip', 'sample', 'vectorSearch']);

const unknownShape: MongoFieldShape = { kind: 'unknown' as const };

function fieldShapeAtPath(shape: MongoResultShape, path: string): MongoFieldShape {
  if (shape.kind !== 'document' || path.includes('.')) {
    return unknownShape;
  }
  return shape.fields[path] ?? unknownShape;
}

function shapeForExpr(currentShape: MongoResultShape, expr: MongoAggExpr): MongoFieldShape {
  if (expr instanceof MongoAggFieldRef) {
    return fieldShapeAtPath(currentShape, expr.path);
  }
  return unknownShape;
}

function resultShapeAfterProject(
  currentShape: MongoResultShape,
  stage: MongoProjectStage,
): MongoResultShape {
  if (currentShape.kind !== 'document') {
    return { kind: 'unknown' as const };
  }
  const fields: Record<string, MongoFieldShape> = {};
  for (const [key, value] of Object.entries(stage.projection)) {
    if (value === 0) {
      continue;
    }
    if (value === 1) {
      fields[key] = currentShape.fields[key] ?? unknownShape;
      continue;
    }
    fields[key] = shapeForExpr(currentShape, value);
  }
  if (!Object.hasOwn(stage.projection, '_id') && currentShape.fields['_id']) {
    fields['_id'] = currentShape.fields['_id'];
  }
  return freezeMongoResultShape({ kind: 'document' as const, fields });
}

function resultShapeAfterAddFields(
  currentShape: MongoResultShape,
  stage: MongoAddFieldsStage,
): MongoResultShape {
  if (currentShape.kind !== 'document') {
    return { kind: 'unknown' as const };
  }
  const fields: Record<string, MongoFieldShape> = { ...currentShape.fields };
  for (const [key, expr] of Object.entries(stage.fields)) {
    fields[key] = shapeForExpr(currentShape, expr);
  }
  return freezeMongoResultShape({ kind: 'document' as const, fields });
}

export function computePipelineResultShape(
  stages: ReadonlyArray<MongoPipelineStage>,
  startShape: MongoResultShape,
): MongoResultShape {
  let shape = startShape;
  for (const stage of stages) {
    if (shape.kind === 'unknown') {
      return { kind: 'unknown' as const };
    }
    if (identityStageKinds.has(stage.kind)) {
      continue;
    }
    if (stage instanceof MongoProjectStage) {
      shape = resultShapeAfterProject(shape, stage);
      continue;
    }
    if (stage instanceof MongoAddFieldsStage) {
      shape = resultShapeAfterAddFields(shape, stage);
      continue;
    }
    return { kind: 'unknown' as const };
  }
  return shape;
}
