import { DIRS } from '@bohr/changelogger/libs/paths/dirs.constant';
import { JSON_FILE_NAME, MD_FILE_NAME } from '@bohr/changelogger/processes/releases/creator/storer/filenames.constant';
import * as path from 'path';

export class PathsResolver {

  public setPaths(): void {
    this.setPath();
    this.setGitPath();
    this.setPackageJsonPath();
    this.setJsonPath();
    this.setMdPath();
  }

  private setPath(): void {
    DIRS.path = process.env.TESTING ? `${process.cwd()}/testfiles` : process.cwd();
  }

  private setGitPath(): void {
    DIRS.gitPath = process.cwd();
  }

  private setPackageJsonPath(): void {
    DIRS.packageJsonPath = path.join(DIRS.path, 'package.json');
  }

  private setJsonPath(): void {
    DIRS.pathToChangelogJson = path.join(DIRS.path, JSON_FILE_NAME);
  }

  private setMdPath(): void {
    DIRS.pathToChangelogMD = path.join(DIRS.path, MD_FILE_NAME);
  }

}
