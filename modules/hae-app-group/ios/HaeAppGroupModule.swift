import Foundation

@objc(HaeAppGroup)
class HaeAppGroupModule: NSObject {

  private let APP_GROUP = "group.org.breizhzion.hae"

  @objc func save(_ serverUrl: String, token: String) {
    let defaults = UserDefaults(suiteName: APP_GROUP)
    defaults?.set(serverUrl, forKey: "hae_server_url")
    defaults?.set(token,     forKey: "hae_token")
    defaults?.synchronize()
  }

  @objc func clear() {
    let defaults = UserDefaults(suiteName: APP_GROUP)
    defaults?.removeObject(forKey: "hae_server_url")
    defaults?.removeObject(forKey: "hae_token")
    defaults?.synchronize()
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
