import { ServiceRegistryError } from "./errors.js";

const serviceAccess = Symbol("opalesce.service-access");

interface MissingService {
  readonly found: false;
}

interface AvailableService<T> {
  readonly found: true;
  readonly value: T;
}

type ServiceLookup<T> = MissingService | AvailableService<T>;

interface ServiceAccess<T> {
  read(scope: object): ServiceLookup<T>;
  write(scope: object, value: T): boolean;
}

export interface ServiceToken<T> {
  readonly name: string;
  readonly key: symbol;
  readonly [serviceAccess]: ServiceAccess<T>;
}

export function createServiceToken<T>(name: string): ServiceToken<T> {
  const values = new WeakMap<object, { readonly value: T }>();

  return Object.freeze({
    name,
    key: Symbol(name),
    [serviceAccess]: {
      read(scope: object): ServiceLookup<T> {
        const entry = values.get(scope);

        return entry === undefined
          ? { found: false }
          : {
              found: true,
              value: entry.value,
            };
      },
      write(scope: object, value: T): boolean {
        if (values.has(scope)) {
          return false;
        }

        values.set(scope, { value });
        return true;
      },
    },
  });
}

export class ServiceRegistry {
  private readonly scope = {};

  provide<T>(token: ServiceToken<T>, value: T): void {
    if (!token[serviceAccess].write(this.scope, value)) {
      throw new ServiceRegistryError("duplicate-service", token.name);
    }
  }

  get<T>(token: ServiceToken<T>): T {
    const lookup = token[serviceAccess].read(this.scope);

    if (!lookup.found) {
      throw new ServiceRegistryError("missing-service", token.name);
    }

    return lookup.value;
  }
}
