export class JavaStringHash {
  private hash: number = 0;
  private hashIsZero = false;

  constructor(private value: string) {}

  hashCode(): number {
    let h = this.hash;

    if (h === 0 && !this.hashIsZero) {
      h = this.computeHash(this.value);

      if (h === 0) {
        this.hashIsZero = true;
      } else {
        this.hash = h;
      }
    }

    return h & 0xfffffff;
  }

  private computeHash(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) | 0;
    }
    return h;
  }
}
