import * as Typing from "./typing";


export const String = Typing.type<string>("String");
export const Number = Typing.type<number>("Number");
export const Bigint = Typing.type<bigint>("Bigint");
export const Boolean = Typing.type<boolean>("Boolean");
export const Undefined = Typing.type<undefined>("unknown");
export const Symbol = Typing.type<symbol>("Symbol");
export const Object = Typing.type<{}>("Object");
export const Array = Typing.type<[]>("Array");
export const Function = Typing.type<() => any>("Function");
export const Unknown = Typing.type<unknown>("unknown");
export const Type = Typing.type<Type<unknown>>("Type");
export const Void = Typing.type<void>("void");
