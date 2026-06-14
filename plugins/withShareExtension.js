const { withXcodeProject, withEntitlementsPlist } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const APP_GROUP     = 'group.org.breizhzion.hae';
const EXT_BUNDLE_ID = 'org.breizhzion.hae.ShareExtension';
const EXT_NAME      = 'ShareExtension';
const SRC_DIR       = path.join(__dirname, 'shareExtension');

function genUuid(project) {
  if (typeof project.generateUuid === 'function') return project.generateUuid();
  return [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
}

function stripQuotes(s) {
  return s ? String(s).replace(/^"|"$/g, '') : '';
}

const withAppGroupEntitlement = (config) =>
  withEntitlementsPlist(config, (mod) => {
    const groups = mod.modResults['com.apple.security.application-groups'] ?? [];
    if (!groups.includes(APP_GROUP)) groups.push(APP_GROUP);
    mod.modResults['com.apple.security.application-groups'] = groups;
    return mod;
  });

const withShareExtensionTarget = (config) =>
  withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const iosDir  = path.join(mod.modRequest.projectRoot, 'ios');
    const extDir  = path.join(iosDir, EXT_NAME);

    // Copie les fichiers source
    if (!fs.existsSync(extDir)) fs.mkdirSync(extDir, { recursive: true });
    for (const file of ['ShareViewController.swift', 'Info.plist', 'ShareExtension.entitlements']) {
      fs.copyFileSync(path.join(SRC_DIR, file), path.join(extDir, file));
    }

    const hash    = project.hash.project || project.hash;
    const objects = hash.objects;

    // Évite double ajout
    const existingGroups = objects.PBXGroup || {};
    if (Object.values(existingGroups).some(g => g && stripQuotes(g.name) === EXT_NAME)) return mod;

    // File references
    const swiftFileRefUUID  = genUuid(project);
    const plistFileRefUUID  = genUuid(project);
    const productFileRefUUID = genUuid(project);

    objects.PBXFileReference = objects.PBXFileReference || {};
    objects.PBXFileReference[swiftFileRefUUID] = {
      isa: 'PBXFileReference',
      fileEncoding: 4,
      lastKnownFileType: 'sourcecode.swift',
      name: '"ShareViewController.swift"',
      path: `"${EXT_NAME}/ShareViewController.swift"`,
      sourceTree: '"<group>"',
    };
    objects.PBXFileReference[swiftFileRefUUID + '_comment'] = 'ShareViewController.swift';

    objects.PBXFileReference[plistFileRefUUID] = {
      isa: 'PBXFileReference',
      lastKnownFileType: 'text.plist.xml',
      name: '"Info.plist"',
      path: `"${EXT_NAME}/Info.plist"`,
      sourceTree: '"<group>"',
    };
    objects.PBXFileReference[plistFileRefUUID + '_comment'] = 'Info.plist';

    objects.PBXFileReference[productFileRefUUID] = {
      isa: 'PBXFileReference',
      explicitFileType: 'wrapper.app-extension',
      includeInIndex: 0,
      path: `"${EXT_NAME}.appex"`,
      sourceTree: 'BUILT_PRODUCTS_DIR',
    };
    objects.PBXFileReference[productFileRefUUID + '_comment'] = `${EXT_NAME}.appex`;

    // Build file (Swift)
    const swiftBuildFileUUID = genUuid(project);
    objects.PBXBuildFile = objects.PBXBuildFile || {};
    objects.PBXBuildFile[swiftBuildFileUUID] = {
      isa: 'PBXBuildFile',
      fileRef: swiftFileRefUUID,
      fileRef_comment: 'ShareViewController.swift',
    };
    objects.PBXBuildFile[swiftBuildFileUUID + '_comment'] = 'ShareViewController.swift in Sources';

    // Groupe PBX
    const extGroupUUID = genUuid(project);
    objects.PBXGroup = objects.PBXGroup || {};
    objects.PBXGroup[extGroupUUID] = {
      isa: 'PBXGroup',
      children: [
        { value: swiftFileRefUUID, comment: 'ShareViewController.swift' },
        { value: plistFileRefUUID, comment: 'Info.plist' },
      ],
      name: `"${EXT_NAME}"`,
      path: `"${EXT_NAME}"`,
      sourceTree: '"<group>"',
    };
    objects.PBXGroup[extGroupUUID + '_comment'] = EXT_NAME;

    // Ajoute le groupe au groupe de l'app principale
    for (const key of Object.keys(objects.PBXGroup)) {
      if (key.endsWith('_comment')) continue;
      const g = objects.PBXGroup[key];
      if (!g) continue;
      if (stripQuotes(g.name) === mod.modRequest.projectName ||
          stripQuotes(g.path) === mod.modRequest.projectName) {
        g.children = g.children || [];
        g.children.push({ value: extGroupUUID, comment: EXT_NAME });
        break;
      }
    }

    // Ajoute le produit au groupe Products
    for (const key of Object.keys(objects.PBXGroup)) {
      if (key.endsWith('_comment')) continue;
      const g = objects.PBXGroup[key];
      if (g && stripQuotes(g.name) === 'Products') {
        g.children = g.children || [];
        g.children.push({ value: productFileRefUUID, comment: `${EXT_NAME}.appex` });
        break;
      }
    }

    // Sources build phase
    const sourcesBuildPhaseUUID = genUuid(project);
    objects.PBXSourcesBuildPhase = objects.PBXSourcesBuildPhase || {};
    objects.PBXSourcesBuildPhase[sourcesBuildPhaseUUID] = {
      isa: 'PBXSourcesBuildPhase',
      buildActionMask: 2147483647,
      files: [{ value: swiftBuildFileUUID, comment: 'ShareViewController.swift in Sources' }],
      runOnlyForDeploymentPostprocessing: 0,
    };
    objects.PBXSourcesBuildPhase[sourcesBuildPhaseUUID + '_comment'] = 'Sources';

    // Build configurations
    const debugConfigUUID   = genUuid(project);
    const releaseConfigUUID = genUuid(project);
    const configListUUID    = genUuid(project);
    const buildSettings = {
      CODE_SIGN_ENTITLEMENTS: `"${EXT_NAME}/ShareExtension.entitlements"`,
      CODE_SIGN_STYLE: 'Automatic',
      INFOPLIST_FILE: `"${EXT_NAME}/Info.plist"`,
      IPHONEOS_DEPLOYMENT_TARGET: '16.0',
      PRODUCT_BUNDLE_IDENTIFIER: `"${EXT_BUNDLE_ID}"`,
      PRODUCT_NAME: `"${EXT_NAME}"`,
      SKIP_INSTALL: 'YES',
      SWIFT_VERSION: '5.0',
      TARGETED_DEVICE_FAMILY: '"1,2"',
    };

    objects.XCBuildConfiguration = objects.XCBuildConfiguration || {};
    objects.XCBuildConfiguration[debugConfigUUID] = { isa: 'XCBuildConfiguration', buildSettings, name: 'Debug' };
    objects.XCBuildConfiguration[debugConfigUUID + '_comment'] = 'Debug';
    objects.XCBuildConfiguration[releaseConfigUUID] = { isa: 'XCBuildConfiguration', buildSettings, name: 'Release' };
    objects.XCBuildConfiguration[releaseConfigUUID + '_comment'] = 'Release';

    objects.XCConfigurationList = objects.XCConfigurationList || {};
    objects.XCConfigurationList[configListUUID] = {
      isa: 'XCConfigurationList',
      buildConfigurations: [
        { value: debugConfigUUID, comment: 'Debug' },
        { value: releaseConfigUUID, comment: 'Release' },
      ],
      defaultConfigurationIsVisible: 0,
      defaultConfigurationName: 'Release',
    };
    objects.XCConfigurationList[configListUUID + '_comment'] = `Build configuration list for PBXNativeTarget "${EXT_NAME}"`;

    // Target
    const targetUUID = genUuid(project);
    objects.PBXNativeTarget = objects.PBXNativeTarget || {};
    objects.PBXNativeTarget[targetUUID] = {
      isa: 'PBXNativeTarget',
      buildConfigurationList: configListUUID,
      buildConfigurationList_comment: `Build configuration list for PBXNativeTarget "${EXT_NAME}"`,
      buildPhases: [{ value: sourcesBuildPhaseUUID, comment: 'Sources' }],
      buildRules: [],
      dependencies: [],
      name: `"${EXT_NAME}"`,
      productName: `"${EXT_NAME}"`,
      productReference: productFileRefUUID,
      productReference_comment: `${EXT_NAME}.appex`,
      productType: '"com.apple.product-type.app-extension"',
    };
    objects.PBXNativeTarget[targetUUID + '_comment'] = EXT_NAME;

    // Ajoute le target au PBXProject
    for (const key of Object.keys(objects.PBXProject || {})) {
      if (key.endsWith('_comment')) continue;
      const proj = objects.PBXProject[key];
      if (proj) {
        proj.targets = proj.targets || [];
        proj.targets.push({ value: targetUUID, comment: EXT_NAME });
        break;
      }
    }

    return mod;
  });

module.exports = (config) => {
  config = withAppGroupEntitlement(config);
  config = withShareExtensionTarget(config);
  return config;
};
