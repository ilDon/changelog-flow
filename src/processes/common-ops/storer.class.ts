import { DIRS } from 'changelog-flow/libs/paths/dirs.constant';
import { Loader } from 'changelog-flow/processes/common-ops/loader.class';
import { writeJSONSync } from 'fs-extra';

export class Storer extends Loader {

  protected init(): void {
    this.loadChangelogger();
  }

  protected finish(): void {
    this.doStoreChanges();
    console.log('\nChanges stored in changelog.json');
  }

  protected doStoreChanges(): void {
    writeJSONSync(DIRS.pathToChangelogJson, this.changeLogger, { spaces: 2 });
  }

}
