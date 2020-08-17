
declare interface Type<T = unknown> {
    readonly $typeInstance: boolean;
    readonly module?: string;
    readonly path?: string;
}
