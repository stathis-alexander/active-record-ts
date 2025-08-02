export class PlainString {
  public strings: string[] = [];
  collect = (other: string) => {
    this.strings.push(other);
    return this;
  };
  value = () => this.strings.join('');
}
