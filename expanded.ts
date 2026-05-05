
export type ExpandDeep<T> = T extends
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | Date
  | RegExp
  | ((...args: never[]) => unknown)
  ? T
  : T extends object
  ? { [K in keyof T]: ExpandDeep<T[K]> }
  : T;

// ---------------------------------------------------------------------------
// Usage examples
// ---------------------------------------------------------------------------

type Address = {
  street: string;
  city: string;
};

type User = {
  id: number;
  name: string;
  address: Address;
};

type IntersectionType = { a: string } & { b: number } & { c: boolean };

export type ExpandedDeepUser = ExpandDeep<User>;
//          ^? { id: number; name: string; address: { street: string; city: string } }

export type ExpandedIntersection = ExpandDeep<IntersectionType>;
//          ^? { a: string; b: number; c: boolean }
