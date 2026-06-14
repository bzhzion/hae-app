const { withXcodeProject, withEntitlementsPlist, IOSConfig } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const APP_GROUP      = 'group.org.breizhzion.hae';
const EXT_BUNDLE_ID  = 'org.breizhzion.hae.ShareExtension';
const EXT_NAME       = 'ShareExtension';
const SRC_DIR        = path.join(__dirname, 'shareExtension');

// 1. Ajoute App Group à l'entitlement de l'app principale
const withAppGroupEntitlement = (config) =>
  withEntitlementsPlist(config, (mod) => {
    const groups = mod.modResults['com.apple.security.application-groups'] ?? [];
    if (!groups.includes(APP_GROUP)) groups.push(APP_GROUP);
    mod.modResults['com.apple.security.application-groups'] = groups;
    return mod;
  });

// 2. Ajoute le target Share Extension au projet Xcode
const withShareExtensionTarget = (config) =>
  withXcodeProject(config, (mod) => {
    const project    = mod.modResults;
    const projectDir = path.dirname(mod.modRequest.projectRoot + '/ios/' + mod.modRequest.projectName + '.xcodeproj');
    const iosDir     = path.join(mod.modRequest.projectRoot, 'ios');
    const extDir     = path.join(iosDir, EXT_NAME);

    // Copie les fichiers source
    if (!fs.existsSync(extDir)) fs.mkdirSync(extDir, { recursive: true });
    for (const file of ['ShareViewController.swift', 'Info.plist', 'ShareExtension.entitlements']) {
      fs.copyFileSync(path.join(SRC_DIR, file), path.join(extDir, file));
    }

    // Évite double ajout
    if (project.pbxGroupByName(EXT_NAME)) return mod;

    const extGroup = project.addPbxGroup(
      ['ShareViewController.swift', 'Info.plist'],
      EXT_NAME,
      EXT_NAME
    );

    // Ajoute au groupe racine (besoin du UUID, pas de l'objet)
    const pbxGroups = project.hash.project.objects.PBXGroup || {};
    let rootGroupUUID = null;
    for (const key of Object.keys(pbxGroups)) {
      if (key.endsWith('_comment')) continue;
      const g = pbxGroups[key];
      if (g && (g.name === 'CustomTemplate' || g.name === mod.modRequest.projectName ||
                g.path === mod.modRequest.projectName)) {
        rootGroupUUID = key;
        break;
      }
    }
    if (rootGroupUUID) {
      project.addToPbxGroup(extGroup.uuid, rootGroupUUID);
    }

    // Crée le target
    const target = project.addTarget(EXT_NAME, 'app_extension', EXT_NAME, EXT_BUNDLE_ID);

    // Build settings
    const setBuildSetting = (key, value) => {
      project.updateBuildProperty(key, value, null, EXT_NAME);
    };

    setBuildSetting('PRODUCT_NAME',              EXT_NAME);
    setBuildSetting('SWIFT_VERSION',             '5.0');
    setBuildSetting('IPHONEOS_DEPLOYMENT_TARGET','16.0');
    setBuildSetting('INFOPLIST_FILE',            `${EXT_NAME}/Info.plist`);
    setBuildSetting('CODE_SIGN_ENTITLEMENTS',    `${EXT_NAME}/ShareExtension.entitlements`);
    setBuildSetting('TARGETED_DEVICE_FAMILY',    '1,2');
    setBuildSetting('SKIP_INSTALL',              'YES');

    // Ajoute les fichiers source au target
    project.addSourceFile('ShareViewController.swift', { target: target.uuid }, EXT_NAME);

    return mod;
  });

module.exports = (config) => {
  config = withAppGroupEntitlement(config);
  config = withShareExtensionTarget(config);
  return config;
};
