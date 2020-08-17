/// <reference path="global.d.ts" />
import * as Primitives from "./primitives";

const TypeSignature = Symbol("type:sign");
const TypeReference = Symbol("type:ref");
const TypeArguments = Symbol("type:arguments");
const CachedType = Symbol("type:cache");

const PrimitiveNames: Readonly<Record<string, Type<unknown>>> = {
    "string": Primitives.String,
    "number": Primitives.Number,
    "bigint": Primitives.Bigint,
    "boolean": Primitives.Boolean,
    "undefined": Primitives.Undefined,
    "symbol": Primitives.Symbol,
    "array": Primitives.Array,
    "object": Primitives.Object,
    "function": Primitives.Function,
    "unknown": Primitives.Unknown,
    "type": Primitives.Type,
    "void": Primitives.Void,
};

const Names = new Map<string, Type>();
const ComplexMap = {};

export type Constructor<T = unknown, TArgs extends unknown[] = unknown[]> = new (...args: TArgs) => T;
export type Class<T = new (...args: unknown[]) => unknown> = T extends new (...args: unknown[]) => unknown ? T : never;
export type Typed<T = unknown> = { Type: Type<T> };
export type Reference<T = unknown> = Type<T> | Typed<T> | Class<T> | Constructor<T> | string;

export interface ClassType<T extends new (...args: unknown[]) => unknown> extends Type<T> {
    constructor: Class<T>;
}

export interface ComplexType<T, TArgs extends Type[]> extends Type<T> {
    [TypeReference]: Type<T>;
    [TypeArguments]: Array<TArgs>;
}

export interface ArrayType<TArgs extends Type[]> extends ComplexType<Array<TArgs>, TArgs> {

} 

interface Prototype<T extends unknown = unknown> {
    constructor: Class<T>;
    [key: string]: unknown;
};

export function register(name: string): ClassDecorator {
    return (target) => {
        if (isClass(target)) {
            registerClass(name, target);
        }
    };
}

function registerClass<T extends new (...args: unknown[]) => unknown>(name: string, object: Class<T>) {
    const type = parse(name) as ClassType<T>;
    type.constructor = object;
    store(object, type);
}

export function baseType<T>(type: Type<T>): Type<T> {
    return type[TypeReference] || type;
}

export function typeArguments<T, TArgs extends Type[]>(type: ComplexType<T, TArgs>): TArgs[] | undefined;
export function typeArguments<T>(type: Type<T>): Type[] | undefined {
    return Reflect.get(type, TypeArguments);
}

export function type<T = unknown, P extends T = T>(ref: Reference<P>): Type<T> {
    if (typeof(ref) === "string") {
        return parse(ref);
    }
    if (isTyped(ref)) {
        return ref.Type;
    }
    if (isType(ref)) {
        return ref;
    }
    if (isClass(ref)) {
        return getClassType(ref);
    }
    throw new Error(`Invalid type reference ${ref}`);
}

export function complex<T, TArgs extends Array<Typed | string>>(
    base: Reference<T> | string,
    typeArguments: TArgs,
): ComplexType<T, Type[]> {
    debugger;
    const first = baseType(type(base as any));
    const args = typeArguments.map((arg) => type(arg as any));
    const path = [first, ...args];
    const last = path.pop();
    const lastSign = last[TypeSignature];
    let scope = ComplexMap;
    for (const ty of path) {
        const tySign = ty[TypeSignature];
        let elem = scope[tySign];
        if (isType(elem)) {
            const elemSign = elem[TypeSignature];
            elem = {
                [elemSign]: elem,
            };
            scope[tySign] = elem;
        }
        if (typeof(elem) === "undefined") {
            elem = {};
            scope[tySign] = elem;
        }
        scope = elem;
    }
    const elem = scope[lastSign];
    if (isType(elem)) {
        return elem as ComplexType<T, Type[]>;
    }
    if (typeof(elem) === "undefined") {
        const t = createComplex<T, Type[]>(first, args);
        scope[lastSign] = t;
        return t;
    }
    return createComplex<T, Type[]>(first, args);
}

export function store<T extends unknown>(v: T, t: Type<T>): void {
    const p = typeof(v);
    if (p === "object" || p === "function") {
        Reflect.defineProperty(v as object, CachedType, {
            configurable: false,
            enumerable: false,
            writable: false,
            value: t,
        });
    }
}

export function restore<T extends unknown>(v: T): Type<T>|undefined {
    const p = typeof(v);
    if (p === "object" || p === "function") {
        const descr = Reflect.getOwnPropertyDescriptor(v as object, CachedType);
        return descr ? descr.value : undefined;
    }
    return undefined;
}

function named<T>(name: string): Type<T> {
    let type = Names.get(name);
    if (!type) {
        type = create();
        Reflect.defineProperty(type, Symbol.toStringTag, {
            configurable: false,
            enumerable: false,
            writable: false,
            value: name,
        });
        Names.set(name, type);
    }
    return type;
}

function parse<T>(name: string): Type<T> {
    if (Names.has(name)) {
        return Names.get(name);
    }
    if (PrimitiveNames[name]) {
        return PrimitiveNames[name];
    }
    let [module, fqn] = name.split("::", 2);
    if (!fqn) {
        fqn = module;
        module = undefined;
    }
    const match = fqn.match(/^(.*)\<(.*)\>$/);
    const [path, typeParams] = match ? [match[1], match[2]] : [fqn];
    let result = named(module ? `${module}::${path}` : path);
    Object.assign(result, { module, path });
    if (typeParams) {
        debugger;
        const params = [];
        let intent = 0;
        let lastIndex = 0;
        for (let i = 0; i < typeParams.length; ++i) {
            const char = typeParams.charAt(i);
            if (char === "<") {
                intent++;
            } else if (char === ">") {
                intent--;
            } else if (char === "," && intent === 0) {
                params.push(typeParams.substring(lastIndex, i).trim());
                lastIndex = i + 1;
            }
        }
        params.push(typeParams.substring(lastIndex).trim());
        const type = result = complex(result, params);
        const paramNames = type[TypeArguments].map((arg) => arg[Symbol.toStringTag]).join(", ");
        name = `${type[TypeReference][Symbol.toStringTag]}<${paramNames}>`;

        Reflect.defineProperty(result, Symbol.toStringTag, {
            configurable: false,
            enumerable: false,
            writable: false,
            value: name,
        });
        Names.set(name, result);
        Object.assign(result, { module, path });
    }
    return result;
}

export function typeOf<T extends unknown>(v: T): Type<T> {
    if (isType(v)) {
        return Primitives.Type;
    }
    if (typeof(v) === "object") {
        return restore(v) || getObjectType(v as Record<string, unknown>);
    }
    if (typeof(v) === "function") {
        return restore(v) || getClassType(v as Class<T>);
    }
    return PrimitiveNames[getPrimitiveType(v)] || Primitives.Unknown;
}

export function compare<L, R>(l: Type<L>, r: Type<R>): l is Type<R> {
    return hashOf(l) === hashOf(r);
}

export function nameOf(v: globalThis.Type): string | undefined {
    return Reflect.get(v, Symbol.toStringTag);
}

export function hashOf(v: globalThis.Type): symbol {
    return Reflect.get(v, TypeSignature);
}

export function isTyped(v: unknown): v is Typed<unknown> {
    return typeof(v) === "object" && isType(v["Type"]);
}

export function isClass(v: unknown): v is Class<unknown> {
    return typeof(v) === "function";
}

export function isType(v: unknown): v is globalThis.Type<unknown> {
    return typeof(v) === "object" && !!v[TypeSignature];
}

function isPrototype(v: unknown): v is Prototype {
    return typeof(v) === "object" && Object.getOwnPropertyNames(v).includes("constructor");
}

export function create<T>(): Type<T> {
    const type = {} as Type<T>;
    Reflect.defineProperty(type, TypeSignature, {
        writable: false,
        configurable: false,
        enumerable: false,
        value: Symbol(),
    });
    return type;
}

export function createComplex<T, TArgs extends Type[]>(base: Type<T>, args: TArgs): ComplexType<T, TArgs> {
    const complex = create() as ComplexType<T, TArgs>;
    Reflect.defineProperty(complex, TypeReference, {
        configurable: false,
        writable: false,
        enumerable: false,
        value: base,
    });
    Reflect.defineProperty(complex, TypeArguments, {
        configurable: false,
        writable: false,
        enumerable: false,
        value: args,
    });
    return complex;
}


function getObjectType<T extends Record<string, unknown>>(v: T): Type<T> {
    if (isPrototype(v)) {
        return getPrototypeType(v);
    }
    return getInstanceType(v);
}

function getInstanceType<T extends Record<string, unknown>>(v: T): Type<T> {
    let type = restore(v);
    if (!type) {
        const proto = Reflect.getPrototypeOf(v) as Prototype;
        type = proto !== Object.prototype ? getPrototypeType(proto) : Primitives.Object;
        store(v, type);
    }
    return type; 
}

function getPrototypeType<T extends unknown>(v: Prototype<T>): Type<T> {
    return getClassType(v.constructor);
}

function getClassType<T extends unknown>(v: Class<T>): Type<T> {
    let type = restore(v);
    if (!type) {
        const name = extractName(v);
        type = name ? named(name) : create();
        store(v, type);
    }
    return type; 
}

function getPrimitiveType(v: unknown): string {
    if (Array.isArray(v)) {
        return "array";
    }
    switch (v) {
        case String:
            return "string";
        case Number:
            return "number";
        case Boolean:
            return "boolean";
        case Symbol:
            return "symbol";
        case Object:
            return "object";
        case Function:
            return "function";
        default:
            return typeof(v);
    }
}

function extractName(v: unknown): string | undefined {
    if (typeof(v) === "object" && "constructor" in v) {
        v = v["constructor"];
    }
    return typeof(v) === "function"
        ? v.name 
        : undefined;
}
