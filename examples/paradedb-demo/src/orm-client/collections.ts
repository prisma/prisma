import { Collection } from '@prisma/orm-postgres/orm-client';
import type { Contract } from '../prisma/contract.d';

export class ItemCollection extends Collection<Contract, 'Item'> {}
