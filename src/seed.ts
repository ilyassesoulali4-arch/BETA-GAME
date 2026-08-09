const STORAGE_KEY = "endless-world:seed";

const SEED_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SEED_LENGTH = 12;

function randomString(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * SEED_ALPHABET.length);
    result += SEED_ALPHABET[index];
  }
  return result;
}

/**
 * A Seed represents the identity of a world.
 *
 * For version 0.1 it is only generated, persisted and displayed. Later it will
 * drive procedural generation of the entire world.
 */
export class Seed {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(): Seed {
    return new Seed(randomString(SEED_LENGTH));
  }

  static load(): Seed {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return new Seed(stored);
    }
    const seed = Seed.create();
    seed.save();
    return seed;
  }

  save(): void {
    localStorage.setItem(STORAGE_KEY, this.value);
  }
}
