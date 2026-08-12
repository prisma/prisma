import type { contract as facadeContract } from './contract-facade.js';
import type { contract as verboseContract } from './contract-verbose.js';

type FacadeOrderFields = typeof facadeContract.models.Order.fields;
type VerboseOrderFields = typeof verboseContract.models.Order.fields;

type FacadeId = FacadeOrderFields['_id'];
type VerboseId = VerboseOrderFields['_id'];

declare const facadeIdValue: FacadeId;
declare const verboseIdValue: VerboseId;

const _facadeProbe: '__force_print_facadeId__' = facadeIdValue;
const _verboseProbe: '__force_print_verboseId__' = verboseIdValue;

export { _facadeProbe, _verboseProbe };
