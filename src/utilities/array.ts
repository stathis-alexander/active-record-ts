export const last = <T>(array: T[]): T | undefined => array[array.length - 1];

export const lastOrThrow = <T>(array: T[]): T => {
  const lastElement = array[array.length - 1];
  if (lastElement == null) throw new Error('Last called on an empty array');
  return lastElement;
};
