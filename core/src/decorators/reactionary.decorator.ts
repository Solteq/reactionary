export function Reactionary(options: unknown): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const original = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      console.log('calling through reactionary decoration!');
      return original.apply(this, args);
    };
    
    return descriptor;
  };
}