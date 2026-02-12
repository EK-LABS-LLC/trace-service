export class ConsumerNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsumerNotFoundError";
  }
}
