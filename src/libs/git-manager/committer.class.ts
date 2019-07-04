import { FilesToCommit } from '@bohr/changelogger/libs/git-manager/uncommitted-checker.class';
import { DIRS } from '@bohr/changelogger/libs/paths/dirs.constant';
import { COMMITT_MESSAGE } from '@bohr/changelogger/questions/git/commit-message.constant';
import { questionMaker } from '@bohr/changelogger/questions/question-maker.function';
import { Git } from 'git-interface';
import * as cmd from 'node-cmd';
import { promisify } from 'util';

export class Committer {

  private git: Git;

  constructor(
    private files?: FilesToCommit,
    private committMessage?: string
  ) { }

  public async commit(): Promise<void> {
    if (!this.committMessage)
      console.log('\nSome files need to be committed before proceeding\n');

    this.setGit();

    await this.addFiles();

    if (!this.committMessage)
      await this.askMessage();

    console.log('\nRunning commit and push commands. Please wait.\n');

    await this.commitFiles();
    await this.push();
  }

  private setGit(): void {
    this.git = new Git({
      dir: DIRS.gitPath
    });
  }

  private async addFiles(): Promise<void> {
    await this.git.add();
  }

  private async askMessage(): Promise<void> {
    const answer = await questionMaker([COMMITT_MESSAGE]);
    this.committMessage = answer['message'];
  }

  private async commitFiles(): Promise<void> {
    try {
      await promisify(cmd.get)(`git commit -m "${this.committMessage}"`);
    } catch (err) {
      console.log('Error 1', err);
    }
  }

  private async push(): Promise<void> {
    try {
      await this.git.push();
    } catch (err) {
      console.log('error 2', err);
    }
  }

}
