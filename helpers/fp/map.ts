import type {Key} from '../types/Any/Key';
import type {List} from '../types/List/List';
import type {Update as LUpdate} from '../types/List/Update';
import {Object} from '../types/Object/Object';
import type {Update as OUpdate} from '../types/Object/Update';
import {reduce} from './reduce';

export type LMapper<I, A> = (item: I, key: number) => A;
export type OMapper<I, A> = (item: I, key: string) => A;

const mapArray = <L extends List, I, A>(
    list: L & List<I>,
    mapper: (item: I, key: number) => A,
): LUpdate<L, Key, A> => {
    return reduce(Object.entries(list), (reduced, item) => {
        reduced[+item[0]] = mapper(item[1], +item[0]);

        return reduced;
    }, [] as unknown[]) as any;
};

const mapObject = <O extends object, I, A>(
    object: O & Object<I>,
    mapper: (item: I, key: string) => A,
): OUpdate<O, Key, A> => {
    return reduce(Object.entries(object), (reduced, item) => {
        reduced[item[0]] = mapper(item[1], item[0]);

        return reduced;
    }, {} as Object) as any;
};

const map:
& typeof mapArray
& typeof mapObject = ((
    object: any,
    mapper: any,
) => {
    return Array.isArray(object)
    ? mapArray(object, mapper)
    : mapObject(object, mapper);
}) as any;

export {map};
