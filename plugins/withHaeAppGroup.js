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

function hasFileRef(objects, filename) {
  return Object.values(objects.PBXFileReference || {}).some(
    ref => ref && stripQuotes(ref.name) === filename
  );
}

module.exports = (config) =>
  withXcodeProject(config, (mod) => {
    const project     = mod.modResults;
    const projectName = mod.modRequest.projectName;
    const iosDir      = path.join(mod.modRequest.projectRoot, 'ios');
    const destDir     = path.join(iosDir, projectName);
    const hash        = project.hash.project || project.hash;
    const objects     = hash.objects;

    // Ensure destination directory exists
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    for (const file of ['HaeAppGroupModule.swift', 'HaeAppGroupModule.m']) {
      // Copy file unconditionally on each prebuild
      const src  = path.join(MODULE_DIR, file);
      const dest = path.join(destDir, file);
      fs.copyFileSync(src, dest);

      // Skip Xcode project manipulation if reference already exists
      if (hasFileRef(objects, file)) continue;

      const isSwift       = file.endsWith('.swift');
      const fileRefUUID   = genUuid(project);
      const buildFileUUID = genUuid(project);

      // Use SOURCE_ROOT-relative path for reliable resolution on any runner
      objects.PBXFileReference = objects.PBXFileReference || {};
      objects.PBXFileReference[fileRefUUID] = {
        isa: 'PBXFileReference',
        fileEncoding: 4,
        lastKnownFileType: isSwift ? 'sourcecode.swift' : 'sourcecode.c.objc',
        name: `"${file}"`,
        path: `"${projectName}/${file}"`,
        sourceTree: '"SOURCE_ROOT"',
      };
      objects.PBXFileReference[fileRefUUID + '_comment'] = file;

      objects.PBXBuildFile = objects.PBXBuildFile || {};
      objects.PBXBuildFile[buildFileUUID] = {
        isa: 'PBXBuildFile',
        fileRef: fileRefUUID,
        fileRef_comment: file,
      };
      objects.PBXBuildFile[buildFileUUID + '_comment'] = `${file} in Sources`;

      // Add to main app group
      let groupFound = false;
      for (const key of Object.keys(objects.PBXGroup || {})) {
        if (key.endsWith('_comment')) continue;
        const g = objects.PBXGroup[key];
        if (!g) continue;
        if (stripQuotes(g.name) === projectName || stripQuotes(g.path) === projectName) {
          g.children = g.children || [];
          g.children.push({ value: fileRefUUID, comment: file });
          groupFound = true;
          break;
        }
      }
      if (!groupFound) {
        // Fallback: add to root group
        for (const key of Object.keys(objects.PBXGroup || {})) {
          if (key.endsWith('_comment')) continue;
          const g = objects.PBXGroup[key];
          if (g && !g.name && !g.path) {
            g.children = g.children || [];
            g.children.push({ value: fileRefUUID, comment: file });
            break;
          }
        }
      }

      // Add to Sources build phase of the main target
      for (const tKey of Object.keys(objects.PBXNativeTarget || {})) {
        if (tKey.endsWith('_comment')) continue;
        const target = objects.PBXNativeTarget[tKey];
        if (!target) continue;
        if (stripQuotes(target.name) !== projectName) continue;
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
