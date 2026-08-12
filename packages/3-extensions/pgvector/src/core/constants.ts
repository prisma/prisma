/**
 * Codec ID for pgvector's vector type.
 */
export const VECTOR_CODEC_ID = 'pg/vector@1' as const;

/**
 * Maximum dimension for pgvector vectors (VECTOR_MAX_DIM from pgvector).
 */
export const VECTOR_MAX_DIM = 16000;
