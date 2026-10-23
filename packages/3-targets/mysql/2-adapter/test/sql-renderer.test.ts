import {
  AggregateExpr,
  AndExpr,
  type AnyQueryAst,
  BinaryExpr,
  CaseExpr,
  CastExpr,
  CodecJsonValueProjection,
  ColumnRef,
  DeleteAst,
  DerivedTableSource,
  EqColJoinOn,
  ExistsExpr,
  FunctionCallExpr,
  FunctionSource,
  IdentifierRef,
  InsertAst,
  JoinAst,
  JsonArrayAggExpr,
  JsonDocumentProjection,
  JsonObjectExpr,
  ListExpression,
  LiteralExpr,
  LockingClause,
  NativeJsonValueProjection,
  NotExpr,
  NullCheckExpr,
  OperationExpr,
  OrderByItem,
  OrExpr,
  ParamRef,
  PreparedParamRef,
  ProjectionItem,
  RawExpr,
  RawQueryAst,
  SelectAst,
  SubqueryExpr,
  TableSource,
  UpdateAst,
  WindowFuncExpr,
} from '@internal/sql-relational-core/ast';
import { createMysqlBuiltinCodecLookup } from '@internal/target-mysql/codecs';
import { describe, expect, it } from 'vitest';
import { renderMysqlSql } from '../src/core/sql-renderer';

const codecs = createMysqlBuiltinCodecLookup();
const lower = (ast: AnyQueryAst) => renderMysqlSql(ast, undefined, codecs);
const sqlOf = (ast: AnyQueryAst) => lower(ast).sql;

const id = ColumnRef.of('user', 'id');
const email = ColumnRef.of('user', 'email');
const fromUser = SelectAst.from(TableSource.named('user'));
const selectId = fromUser.withProjection([ProjectionItem.of('id', id)]);
const whereOf = (where: Parameters<SelectAst['withWhere']>[0]) => sqlOf(selectId.withWhere(where));
const projectionOf = (expr: Parameters<typeof ProjectionItem.of>[1]) =>
  sqlOf(SelectAst.noFrom().withProjection([ProjectionItem.of('v', expr)]));

describe('MySQL lowering of a select', () => {
  it('quotes identifiers with backticks and binds params as ?', () => {
    expect(lower(selectId.withWhere(BinaryExpr.eq(email, ParamRef.of('a@b.c'))))).toEqual({
      sql: 'SELECT `user`.`id` AS `id` FROM `user` WHERE `user`.`email` = ?',
      params: [{ kind: 'literal', value: 'a@b.c' }],
    });
  });

  it('binds a prepared param by name', () => {
    expect(
      lower(
        selectId.withWhere(
          BinaryExpr.eq(email, PreparedParamRef.of('email', { codecId: 'mysql/text@1' })),
        ),
      ).params,
    ).toEqual([{ kind: 'bind', name: 'email' }]);
  });

  it('casts a bigint param to SIGNED, so MySQL compares it with an integer column as an integer', () => {
    const big = ColumnRef.of('t', 'big');
    expect([
      sqlOf(
        selectId.withWhere(
          BinaryExpr.eq(
            big,
            ParamRef.of(9007199254740993n, { codec: { codecId: 'mysql/bigint@1' } }),
          ),
        ),
      ),
      sqlOf(
        selectId.withWhere(
          BinaryExpr.in(
            big,
            ListExpression.of([ParamRef.of(1n, { codec: { codecId: 'mysql/bigint@1' } })]),
          ),
        ),
      ),
      sqlOf(
        selectId.withWhere(
          BinaryExpr.eq(big, PreparedParamRef.of('b', { codecId: 'mysql/bigint@1' })),
        ),
      ),
      sqlOf(
        selectId.withWhere(
          BinaryExpr.eq(id, ParamRef.of(1, { codec: { codecId: 'mysql/int@1' } })),
        ),
      ),
    ]).toEqual([
      'SELECT `user`.`id` AS `id` FROM `user` WHERE `t`.`big` = CAST(? AS SIGNED)',
      'SELECT `user`.`id` AS `id` FROM `user` WHERE `t`.`big` IN (CAST(? AS SIGNED))',
      'SELECT `user`.`id` AS `id` FROM `user` WHERE `t`.`big` = CAST(? AS SIGNED)',
      'SELECT `user`.`id` AS `id` FROM `user` WHERE `user`.`id` = ?',
    ]);
  });

  it('refuses a param whose codec the registry lacks', () => {
    expect(() =>
      sqlOf(
        selectId.withWhere(BinaryExpr.eq(id, ParamRef.of(1, { codec: { codecId: 'pg/x@1' } }))),
      ),
    ).toThrow(expect.objectContaining({ code: 'RUNTIME.PARAM_REF_MISSING_CODEC' }));
  });

  it('keeps params in the order their placeholders appear', () => {
    const ast = fromUser
      .withProjection([ProjectionItem.of('p', ParamRef.of('first'))])
      .withWhere(BinaryExpr.eq(email, ParamRef.of('second')))
      .withLimit(ParamRef.of(3));
    expect(lower(ast)).toEqual({
      sql: 'SELECT ? AS `p` FROM `user` WHERE `user`.`email` = ? LIMIT ?',
      params: [
        { kind: 'literal', value: 'first' },
        { kind: 'literal', value: 'second' },
        { kind: 'literal', value: 3 },
      ],
    });
  });

  it('renders DISTINCT, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT and OFFSET in order', () => {
    const ast = fromUser
      .withProjection([
        ProjectionItem.of('email', email),
        ProjectionItem.of('n', AggregateExpr.count()),
      ])
      .withDistinct()
      .withWhere(BinaryExpr.gt(id, LiteralExpr.of(0)))
      .withGroupBy([email])
      .withHaving(BinaryExpr.gt(AggregateExpr.count(id), LiteralExpr.of(1)))
      .withOrderBy([OrderByItem.desc(email)])
      .withLimit(10)
      .withOffset(5);
    expect(sqlOf(ast)).toBe(
      'SELECT DISTINCT `user`.`email` AS `email`, COUNT(*) AS `n` FROM `user` WHERE `user`.`id` > 0 GROUP BY `user`.`email` HAVING COUNT(`user`.`id`) > 1 ORDER BY `user`.`email` DESC LIMIT 10 OFFSET 5',
    );
  });

  describe('binds each param to the placeholder written for it', () => {
    const lit = (value: unknown) => ({ kind: 'literal', value });

    it('when a join condition and a WHERE both carry one', () => {
      const ast = selectId
        .withJoins([
          JoinAst.inner(
            TableSource.named('post'),
            AndExpr.of([
              BinaryExpr.eq(ColumnRef.of('post', 'authorId'), id),
              BinaryExpr.eq(ColumnRef.of('post', 'title'), ParamRef.of('on')),
            ]),
          ),
        ])
        .withWhere(BinaryExpr.eq(email, ParamRef.of('where')));
      expect(lower(ast)).toEqual({
        sql: 'SELECT `user`.`id` AS `id` FROM `user` INNER JOIN `post` ON (`post`.`authorId` = `user`.`id` AND `post`.`title` = ?) WHERE `user`.`email` = ?',
        params: [lit('on'), lit('where')],
      });
    });

    it('when GROUP BY and HAVING both carry one', () => {
      const ast = fromUser
        .withProjection([ProjectionItem.of('n', AggregateExpr.count())])
        .withGroupBy([BinaryExpr.eq(email, ParamRef.of('group'))])
        .withHaving(BinaryExpr.gt(AggregateExpr.count(), ParamRef.of('having')));
      expect(lower(ast)).toEqual({
        sql: 'SELECT COUNT(*) AS `n` FROM `user` GROUP BY `user`.`email` = ? HAVING COUNT(*) > ?',
        params: [lit('group'), lit('having')],
      });
    });

    it('when the projection and a derived FROM both carry one', () => {
      const derived = selectId.withWhere(BinaryExpr.eq(email, ParamRef.of('from')));
      const ast = SelectAst.from(DerivedTableSource.as('u', derived)).withProjection([
        ProjectionItem.of('p', ParamRef.of('projection')),
      ]);
      expect(lower(ast)).toEqual({
        sql: 'SELECT ? AS `p` FROM (SELECT `user`.`id` AS `id` FROM `user` WHERE `user`.`email` = ?) AS `u`',
        params: [lit('projection'), lit('from')],
      });
    });

    it('when an operation template writes its argument before itself', () => {
      const op = new OperationExpr({
        method: 'locate',
        self: BinaryExpr.eq(email, ParamRef.of('self')),
        args: [ParamRef.of('arg')],
        returns: { codecId: 'mysql/int@1', nullable: false },
        lowering: { targetFamily: 'sql', template: 'LOCATE({{arg0}}, {{self}})' },
      });
      expect(lower(SelectAst.noFrom().withProjection([ProjectionItem.of('v', op)]))).toEqual({
        sql: 'SELECT LOCATE(?, `user`.`email` = ?) AS `v`',
        params: [lit('arg'), lit('self')],
      });
    });
  });

  it('writes an OFFSET with no LIMIT with the largest row count MySQL takes', () => {
    expect(sqlOf(selectId.withOffset(5))).toBe(
      'SELECT `user`.`id` AS `id` FROM `user` LIMIT 18446744073709551615 OFFSET 5',
    );
  });

  it('selects from a derived table', () => {
    const ast = SelectAst.from(DerivedTableSource.as('u', selectId)).withProjection([
      ProjectionItem.of('id', ColumnRef.of('u', 'id')),
    ]);
    expect(sqlOf(ast)).toBe(
      'SELECT `u`.`id` AS `id` FROM (SELECT `user`.`id` AS `id` FROM `user`) AS `u`',
    );
  });

  it('aliases a table', () => {
    expect(
      sqlOf(
        SelectAst.from(TableSource.named('user', 'u')).withProjection([
          ProjectionItem.of('id', ColumnRef.of('u', 'id')),
        ]),
      ),
    ).toBe('SELECT `u`.`id` AS `id` FROM `user` AS `u`');
  });

  it('renders inner, left and right joins', () => {
    const on = EqColJoinOn.of(ColumnRef.of('post', 'authorId'), id);
    const ast = selectId.withJoins([
      JoinAst.inner(TableSource.named('post'), on),
      JoinAst.left(TableSource.named('post'), BinaryExpr.eq(id, LiteralExpr.of(1))),
      JoinAst.right(TableSource.named('post'), on),
    ]);
    expect(sqlOf(ast)).toBe(
      'SELECT `user`.`id` AS `id` FROM `user` INNER JOIN `post` ON `post`.`authorId` = `user`.`id` LEFT JOIN `post` ON `user`.`id` = 1 RIGHT JOIN `post` ON `post`.`authorId` = `user`.`id`',
    );
  });
});

describe('MySQL lowering of expressions', () => {
  it.each([
    ['eq', '`user`.`id` = ?'],
    ['neq', '`user`.`id` <> ?'],
    ['gt', '`user`.`id` > ?'],
    ['lt', '`user`.`id` < ?'],
    ['gte', '`user`.`id` >= ?'],
    ['lte', '`user`.`id` <= ?'],
    ['like', '`user`.`id` LIKE ?'],
    ['isNotDistinctFrom', '`user`.`id` <=> ?'],
    ['isDistinctFrom', 'NOT (`user`.`id` <=> ?)'],
  ] as const)('renders the %s operator', (op, where) => {
    expect(whereOf(new BinaryExpr(op, id, ParamRef.of(1)))).toBe(
      `SELECT \`user\`.\`id\` AS \`id\` FROM \`user\` WHERE ${where}`,
    );
  });

  it('renders IN and NOT IN lists, and an empty list as a constant', () => {
    expect([
      whereOf(BinaryExpr.in(id, ListExpression.of([ParamRef.of(1), ParamRef.of(2)]))),
      whereOf(BinaryExpr.notIn(id, ListExpression.of([LiteralExpr.of(3)]))),
      whereOf(BinaryExpr.in(id, ListExpression.of([]))),
      whereOf(BinaryExpr.notIn(id, ListExpression.of([]))),
    ]).toEqual([
      'SELECT `user`.`id` AS `id` FROM `user` WHERE `user`.`id` IN (?, ?)',
      'SELECT `user`.`id` AS `id` FROM `user` WHERE `user`.`id` NOT IN (3)',
      'SELECT `user`.`id` AS `id` FROM `user` WHERE FALSE',
      'SELECT `user`.`id` AS `id` FROM `user` WHERE TRUE',
    ]);
  });

  it('renders AND, OR, NOT, null checks and EXISTS, and empty AND and OR as constants', () => {
    expect([
      whereOf(
        AndExpr.of([
          OrExpr.of([NullCheckExpr.isNull(email), NullCheckExpr.isNotNull(id)]),
          new NotExpr(ExistsExpr.exists(selectId)),
          ExistsExpr.notExists(selectId),
        ]),
      ),
      whereOf(AndExpr.of([])),
      whereOf(OrExpr.of([])),
    ]).toEqual([
      'SELECT `user`.`id` AS `id` FROM `user` WHERE ((`user`.`email` IS NULL OR `user`.`id` IS NOT NULL) AND NOT (EXISTS (SELECT `user`.`id` AS `id` FROM `user`)) AND NOT EXISTS (SELECT `user`.`id` AS `id` FROM `user`))',
      'SELECT `user`.`id` AS `id` FROM `user` WHERE TRUE',
      'SELECT `user`.`id` AS `id` FROM `user` WHERE FALSE',
    ]);
  });

  it.each([
    ["it's \\ here", "'it''s \\\\ here'"],
    [42, '42'],
    [true, 'TRUE'],
    [false, 'FALSE'],
    [9007199254740993n, '9007199254740993'],
    [null, 'NULL'],
    [new Date('2024-01-02T03:04:05.678Z'), "'2024-01-02 03:04:05.678'"],
    [{ a: "b'c" }, `'{"a":"b''c"}'`],
  ])('renders the literal %s', (value, rendered) => {
    expect(projectionOf(LiteralExpr.of(value))).toBe(`SELECT ${rendered} AS \`v\``);
  });

  it('refuses a number MySQL has no literal for', () => {
    expect(() => projectionOf(LiteralExpr.of(Number.POSITIVE_INFINITY))).toThrow(
      expect.objectContaining({ code: 'RUNTIME.AST_UNSUPPORTED' }),
    );
  });

  it('renders an identifier, a function call, a cast, a CASE and a scalar subquery', () => {
    expect([
      projectionOf(IdentifierRef.of('total')),
      projectionOf(FunctionCallExpr.of('LOWER', [email])),
      projectionOf(CastExpr.as(id, 'CHAR')),
      projectionOf(
        CaseExpr.of(
          [{ condition: BinaryExpr.eq(id, LiteralExpr.of(1)), value: LiteralExpr.of('one') }],
          LiteralExpr.of('other'),
        ),
      ),
      projectionOf(CaseExpr.of([{ condition: NullCheckExpr.isNull(id), value: id }])),
      projectionOf(SubqueryExpr.of(selectId)),
    ]).toEqual([
      'SELECT `total` AS `v`',
      'SELECT LOWER(`user`.`email`) AS `v`',
      'SELECT CAST(`user`.`id` AS CHAR) AS `v`',
      "SELECT CASE WHEN `user`.`id` = 1 THEN 'one' ELSE 'other' END AS `v`",
      'SELECT CASE WHEN `user`.`id` IS NULL THEN `user`.`id` END AS `v`',
      'SELECT (SELECT `user`.`id` AS `id` FROM `user`) AS `v`',
    ]);
  });

  it('renders aggregates and a window function', () => {
    expect([
      projectionOf(AggregateExpr.sum(id)),
      projectionOf(AggregateExpr.max(id)),
      projectionOf(
        WindowFuncExpr.rowNumber({ partitionBy: [email], orderBy: [OrderByItem.asc(id)] }),
      ),
    ]).toEqual([
      'SELECT SUM(`user`.`id`) AS `v`',
      'SELECT MAX(`user`.`id`) AS `v`',
      'SELECT ROW_NUMBER() OVER (PARTITION BY `user`.`email` ORDER BY `user`.`id` ASC) AS `v`',
    ]);
  });

  it('renders an operation from its template, grouping it inside a comparison and a null check', () => {
    const lowerEmail = new OperationExpr({
      method: 'lower',
      self: email,
      args: [ParamRef.of('x')],
      returns: { codecId: 'mysql/text@1', nullable: false },
      lowering: { targetFamily: 'sql', template: 'CONCAT(LOWER({{self}}), {{arg0}})' },
    });
    expect([
      whereOf(BinaryExpr.eq(lowerEmail, LiteralExpr.of('a'))),
      whereOf(NullCheckExpr.isNull(lowerEmail)),
    ]).toEqual([
      "SELECT `user`.`id` AS `id` FROM `user` WHERE (CONCAT(LOWER(`user`.`email`), ?)) = 'a'",
      'SELECT `user`.`id` AS `id` FROM `user` WHERE (CONCAT(LOWER(`user`.`email`), ?)) IS NULL',
    ]);
  });

  it('renders raw SQL fragments and raw queries', () => {
    const raw = new RawExpr({
      parts: ['`user`.`id` > ', ParamRef.of(1)],
      returns: { codecId: 'mysql/int@1', nullable: false },
    });
    expect([
      whereOf(raw),
      sqlOf(RawQueryAst.affectedCount(['SELECT ', ParamRef.of(1), ' + 1'])),
    ]).toEqual(['SELECT `user`.`id` AS `id` FROM `user` WHERE `user`.`id` > ?', 'SELECT ? + 1']);
  });
});

describe('MySQL lowering of JSON for includes', () => {
  const rows = (column: string) => ColumnRef.of('rows', column);
  const object = JsonObjectExpr.fromEntries([
    JsonObjectExpr.entry(
      'id',
      new CodecJsonValueProjection(rows('id'), { codecId: 'mysql/int@1' }),
    ),
    JsonObjectExpr.entry(
      'big',
      new CodecJsonValueProjection(rows('big'), { codecId: 'mysql/bigint@1' }),
    ),
    JsonObjectExpr.entry(
      'at',
      new CodecJsonValueProjection(rows('at'), {
        codecId: 'mysql/datetime@1',
        typeParams: { precision: 3 },
      }),
    ),
    JsonObjectExpr.entry('raw', new NativeJsonValueProjection(rows('raw'))),
    JsonObjectExpr.entry('posts', new JsonDocumentProjection(rows('posts'))),
  ]);
  const objectSql =
    "JSON_OBJECT('id', `rows`.`id`, 'big', CAST(`rows`.`big` AS CHAR), 'at', CAST(`rows`.`at` AS CHAR), 'raw', `rows`.`raw`, 'posts', `rows`.`posts`)";

  it('builds an object with JSON_OBJECT, each value projected by its codec', () => {
    expect(projectionOf(object)).toBe(`SELECT ${objectSql} AS \`v\``);
  });

  it('keeps a to-many include in order with GROUP_CONCAT, cast to JSON, raising the length limit for the statement, an empty include as an empty JSON array, and an array larger than a packet as an error', () => {
    const aggregate = JsonArrayAggExpr.of(new JsonDocumentProjection(object), 'emptyArray', [
      OrderByItem.desc(rows('order_0')),
    ]);
    expect(projectionOf(aggregate)).toBe(
      `SELECT /*+ SET_VAR(group_concat_max_len = 4294967295) */ CASE WHEN COUNT(*) = 0 THEN JSON_ARRAY() ELSE CAST(COALESCE(CONCAT('[', GROUP_CONCAT(${objectSql} ORDER BY \`rows\`.\`order_0\` DESC SEPARATOR ','), ']'), CONCAT('array larger than max_allowed_packet: ', COUNT(*), ' rows')) AS JSON) END AS \`v\``,
    );
  });

  it('writes a scalar element of an ordered array as JSON text', () => {
    expect(
      projectionOf(
        JsonArrayAggExpr.of(new NativeJsonValueProjection(rows('title')), 'null', [
          OrderByItem.asc(rows('title')),
        ]),
      ),
    ).toBe(
      "SELECT /*+ SET_VAR(group_concat_max_len = 4294967295) */ CASE WHEN COUNT(*) = 0 THEN NULL ELSE CAST(COALESCE(CONCAT('[', GROUP_CONCAT(JSON_EXTRACT(JSON_ARRAY(`rows`.`title`), '$[0]') ORDER BY `rows`.`title` ASC SEPARATOR ','), ']'), CONCAT('array larger than max_allowed_packet: ', COUNT(*), ' rows')) AS JSON) END AS `v`",
    );
  });

  it('aggregates an unordered array with JSON_ARRAYAGG', () => {
    expect(projectionOf(JsonArrayAggExpr.of(new JsonDocumentProjection(object)))).toBe(
      `SELECT JSON_ARRAYAGG(${objectSql}) AS \`v\``,
    );
  });

  it('refuses a column whose codec the registry lacks', () => {
    expect(() =>
      projectionOf(
        JsonObjectExpr.fromEntries([
          JsonObjectExpr.entry('x', new CodecJsonValueProjection(rows('x'), { codecId: 'pg/x@1' })),
        ]),
      ),
    ).toThrow(expect.objectContaining({ code: 'RUNTIME.PARAM_REF_MISSING_CODEC' }));
  });
});

describe('MySQL lowering of NULLS FIRST and NULLS LAST', () => {
  it('leads with an IS NULL sort key, since MySQL has no NULLS clause', () => {
    const ast = selectId.withOrderBy([
      OrderByItem.asc(email, { nulls: 'last' }),
      OrderByItem.desc(id, { nulls: 'first' }),
    ]);
    expect(sqlOf(ast)).toBe(
      'SELECT `user`.`id` AS `id` FROM `user` ORDER BY `user`.`email` IS NULL ASC, `user`.`email` ASC, `user`.`id` IS NULL DESC, `user`.`id` DESC',
    );
  });

  it('binds the params of an expression the sort key repeats, once for each placeholder', () => {
    const ast = selectId.withOrderBy([
      OrderByItem.asc(BinaryExpr.eq(id, ParamRef.of(1)), { nulls: 'last' }),
    ]);
    expect(lower(ast)).toEqual({
      sql: 'SELECT `user`.`id` AS `id` FROM `user` ORDER BY `user`.`id` = ? IS NULL ASC, `user`.`id` = ? ASC',
      params: [
        { kind: 'literal', value: 1 },
        { kind: 'literal', value: 1 },
      ],
    });
  });
});

describe('MySQL lowering refusals', () => {
  it.each([
    ['a FULL JOIN', selectId.withJoins([JoinAst.full(TableSource.named('post'), id)])],
    [
      'a LATERAL join',
      selectId.withJoins([
        JoinAst.left(DerivedTableSource.as('p', selectId), BinaryExpr.eq(id, id), true),
      ]),
    ],
    [
      'a function source',
      SelectAst.from(FunctionSource.of('json_table', [])).withProjection([
        ProjectionItem.of('v', LiteralExpr.of(1)),
      ]),
    ],
    ['a locking clause', selectId.withLocking([LockingClause.of('forUpdate')])],
    ['DISTINCT ON', selectId.withDistinctOn([email])],
    ['an insert', InsertAst.into(TableSource.named('user')).withRows([{ id: ParamRef.of(1) }])],
    ['an update', UpdateAst.table(TableSource.named('user')).withSet({ email: ParamRef.of('x') })],
    ['a delete', DeleteAst.from(TableSource.named('user'))],
  ])('refuses %s with RUNTIME.AST_UNSUPPORTED', (_name, ast) => {
    expect(() => sqlOf(ast)).toThrow(expect.objectContaining({ code: 'RUNTIME.AST_UNSUPPORTED' }));
  });
});
