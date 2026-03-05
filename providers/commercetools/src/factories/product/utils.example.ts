export const assertType = <T>(_value: T) => {};

type IsAny<T> = 0 extends (1 & T) ? true : false;

export const assertNotAny = <T>(_value: IsAny<T> extends true ? never : T) => {};
