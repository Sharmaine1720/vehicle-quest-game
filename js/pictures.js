// Per-session deduplication. No private images or student details persist to disk.
export class QuestionPictures {
  constructor(api, token) {
    this.api = api;
    this.token = token;
    this.tasks = new Map();
    this.tail = Promise.resolve();
  }
  async load(question) {
    if (question.image || !question.imageRef) return question.image || "";
    const key = question.imageRef;
    if (!this.tasks.has(key)) {
      // One image request at a time per iPad avoids flooding the class server.
      const task = this.tail
        .then(() =>
          this.api.request("image", {
            token: this.token,
            questionId: question.id,
          }),
        )
        .then((result) => {
          if (!/^data:image\/(png|jpeg|webp);base64,/.test(result.image || ""))
            throw Error("This question picture is unavailable. Please retry.");
          return result.image;
        })
        .catch((error) => {
          this.tasks.delete(key);
          throw error;
        });
      this.tasks.set(key, task);
      this.tail = task.catch(() => {});
    }
    const source = await this.tasks.get(key);
    question.image = source;
    return source;
  }
  prefetch(questions) {
    questions.forEach((question) => this.load(question).catch(() => {}));
  }
}
