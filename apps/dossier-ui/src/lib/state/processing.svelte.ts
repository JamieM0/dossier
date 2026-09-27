class ProcessingState {
  pending = $state(0);

  async track<T>(work: Promise<T>): Promise<T> {
    this.pending += 1;
    try {
      return await work;
    } finally {
      this.pending = Math.max(0, this.pending - 1);
    }
  }
}

export const processing = new ProcessingState();
