import Foundation
import Security

@objc(HaeAppGroup)
class HaeAppGroupModule: NSObject {

  private let ACCESS_GROUP = "group.org.breizhzion.hae"
  private let SERVICE      = "org.breizhzion.hae"

  private func query(key: String) -> [String: Any] {
    [
      kSecClass as String:           kSecClassGenericPassword,
      kSecAttrService as String:     SERVICE,
      kSecAttrAccount as String:     key,
      kSecAttrAccessGroup as String: ACCESS_GROUP,
    ]
  }

  private func write(key: String, value: String) {
    guard let data = value.data(using: .utf8) else { return }
    var q = query(key: key)
    SecItemDelete(q as CFDictionary)
    q[kSecValueData as String]      = data
    q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    SecItemAdd(q as CFDictionary, nil)
  }

  private func remove(key: String) {
    SecItemDelete(query(key: key) as CFDictionary)
  }

  @objc func save(_ serverUrl: String, token: String) {
    write(key: "hae_server_url", value: serverUrl)
    write(key: "hae_token",      value: token)
  }

  @objc func clear() {
    remove(key: "hae_server_url")
    remove(key: "hae_token")
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
