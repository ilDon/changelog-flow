import { MdMaker } from '@bohr/changelogger/renderers/mark-down/md-maker.class';

export function rendererStarter(type: 'md'): void {
  new MdMaker().make();
}
