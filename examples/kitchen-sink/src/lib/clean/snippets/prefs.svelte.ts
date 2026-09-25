class ReadingPrefs {
  fontSize = $state(16);

  larger() {
    this.fontSize += 2;
  }
}

export const readingPrefs = new ReadingPrefs();
