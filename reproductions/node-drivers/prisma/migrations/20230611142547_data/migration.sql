-- This is an empty migration.

INSERT INTO company(id, name) VALUES
	(1, 'Prisma');

INSERT INTO some_user(id, firstname, lastname, company_id) VALUES
	(1, 'Alberto', 'S', 1),
	(2, 'Tom', 'H', 1);
