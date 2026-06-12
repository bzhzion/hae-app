const { withXcodeProject } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const MODULE_DIR = path.join(__dirname, '..', 'modules', 'hae-app-group', 'ios');

module.exports = (config) =>
  withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const iosDir  = path.join(mod.modRequest.projectRoot, 'ios');
    const destDir = path.join(iosDir, mod.modRequest.projectName);

    for (const file of ['HaeAppGroupModule.swift', 'HaeAppGroupModule.m']) {
      const dest = path.join(destDir, file);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(path.join(MODULE_DIR, file), dest);
        project.addSourceFile(`${mod.modRequest.projectName}/${file}`, {});
      }
    }

    return mod;
  });
