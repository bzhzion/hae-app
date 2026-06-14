const { withXcodeProject } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const MODULE_DIR = path.join(__dirname, '..', 'modules', 'hae-app-group', 'ios');

function genUuid(project) {
  if (typeof project.generateUuid === 'function') return project.generateUuid();
  return [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
}

function stripQuotes(s) {
  return s ? String(s).replace(/^"|"$/g, '') : '';
}

module.exports = (config) =>
  withXcodeProject(config, (mod) => {
    const project  = mod.modResults;
    const iosDir   = path.join(mod.modRequest.projectRoot, 'ios');
    const destDir  = path.join(iosDir, mod.modRequest.projectName);
    const hash     = project.hash.project || project.hash;
    const objects  = hash.objects;

    for (const file of ['HaeAppGroupModule.swift', 'HaeAppGroupModule.m']) {
      const dest = path.join(destDir, file);
      if (fs.existsSync(dest)) continue;

      fs.copyFileSync(path.join(MODULE_DIR, file), dest);

      const isSwift       = file.endsWith('.swift');
      const fileRefUUID   = genUuid(project);
      const buildFileUUID = genUuid(project);

      objects.PBXFileReference = objects.PBXFileReference || {};
      objects.PBXFileReference[fileRefUUID] = {
        isa: 'PBXFileReference',
        fileEncoding: 4,
        lastKnownFileType: isSwift ? 'sourcecode.swift' : 'sourcecode.c.objc',
        name: `"${file}"`,
        path: `"${file}"`,
        sourceTree: '"<group>"',
      };
      objects.PBXFileReference[fileRefUUID + '_comment'] = file;

      objects.PBXBuildFile = objects.PBXBuildFile || {};
      objects.PBXBuildFile[buildFileUUID] = {
        isa: 'PBXBuildFile',
        fileRef: fileRefUUID,
        fileRef_comment: file,
      };
      objects.PBXBuildFile[buildFileUUID + '_comment'] = `${file} in Sources`;

      // Ajoute au groupe de l'app principale
      for (const key of Object.keys(objects.PBXGroup || {})) {
        if (key.endsWith('_comment')) continue;
        const g = objects.PBXGroup[key];
        if (!g) continue;
        if (stripQuotes(g.name) === mod.modRequest.projectName ||
            stripQuotes(g.path) === mod.modRequest.projectName) {
          g.children = g.children || [];
          g.children.push({ value: fileRefUUID, comment: file });
          break;
        }
      }

      // Ajoute au Sources build phase du target principal
      for (const tKey of Object.keys(objects.PBXNativeTarget || {})) {
        if (tKey.endsWith('_comment')) continue;
        const target = objects.PBXNativeTarget[tKey];
        if (!target) continue;
        if (stripQuotes(target.name) !== mod.modRequest.projectName) continue;
        for (const phase of (target.buildPhases || [])) {
          const pKey = typeof phase === 'object' ? phase.value : phase;
          const srcPhase = (objects.PBXSourcesBuildPhase || {})[pKey];
          if (srcPhase) {
            srcPhase.files = srcPhase.files || [];
            srcPhase.files.push({ value: buildFileUUID, comment: `${file} in Sources` });
            break;
          }
        }
        break;
      }
    }

    return mod;
  });
