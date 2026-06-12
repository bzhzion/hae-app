import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

let APP_GROUP = "group.org.breizhzion.hae"

struct HaeProject: Decodable {
  let id: String
  let name: String
}

class ShareViewController: UIViewController {

  // MARK: - UI
  private let containerView = UIView()
  private let handleBar     = UIView()
  private let titleLabel    = UILabel()
  private let previewBox    = UIView()
  private let previewLabel  = UILabel()
  private let projectLabel  = UILabel()
  private let projectButton = UIButton(type: .system)
  private let createButton  = UIButton(type: .system)
  private let cancelButton  = UIButton(type: .system)
  private let spinner       = UIActivityIndicatorView(style: .medium)

  // MARK: - State
  private var sharedText: String = ""
  private var sharedUrl:  String = ""
  private var projects:   [HaeProject] = []
  private var selectedProject: HaeProject?
  private var serverUrl: String = ""
  private var token:     String = ""

  // MARK: - Lifecycle

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor.black.withAlphaComponent(0.4)
    setupUI()
    readCredentials()
    extractSharedContent()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard !serverUrl.isEmpty, !token.isEmpty else {
      showError("Connecte-toi à hae d'abord.")
      return
    }
    fetchProjects()
  }

  // MARK: - Credentials

  private func readCredentials() {
    let defaults = UserDefaults(suiteName: APP_GROUP)
    serverUrl = defaults?.string(forKey: "hae_server_url") ?? ""
    token     = defaults?.string(forKey: "hae_token")      ?? ""
  }

  // MARK: - Shared content extraction

  private func extractSharedContent() {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return }
    for item in items {
      for provider in (item.attachments ?? []) {
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
          provider.loadItem(forTypeIdentifier: UTType.url.identifier) { [weak self] data, _ in
            DispatchQueue.main.async {
              if let url = data as? URL {
                self?.sharedUrl  = url.absoluteString
                self?.sharedText = item.attributedContentText?.string ?? url.absoluteString
                self?.updatePreview()
              }
            }
          }
          return
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
          provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { [weak self] data, _ in
            DispatchQueue.main.async {
              if let text = data as? String {
                self?.sharedText = text
                if text.hasPrefix("http") { self?.sharedUrl = text }
                self?.updatePreview()
              }
            }
          }
          return
        }
      }
    }
  }

  private func updatePreview() {
    let display = sharedText.isEmpty ? sharedUrl : sharedText
    previewLabel.text = display.count > 120 ? String(display.prefix(120)) + "…" : display
  }

  // MARK: - API

  private func fetchProjects() {
    spinner.startAnimating()
    createButton.isEnabled = false
    guard let url = URL(string: "\(serverUrl)/api/projects") else { return }
    var req = URLRequest(url: url)
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    URLSession.shared.dataTask(with: req) { [weak self] data, _, _ in
      DispatchQueue.main.async {
        self?.spinner.stopAnimating()
        guard let data = data,
              let list = try? JSONDecoder().decode([HaeProject].self, from: data) else {
          self?.showError("Impossible de charger les projets.")
          return
        }
        self?.projects = list
        self?.selectedProject = list.first
        self?.projectButton.setTitle(list.first?.name ?? "Choisir…", for: .normal)
        self?.createButton.isEnabled = !list.isEmpty
      }
    }.resume()
  }

  private func createCard() {
    guard let project = selectedProject else { return }
    let title = sharedText.isEmpty ? sharedUrl : sharedText
    let desc  = sharedUrl.isEmpty ? nil : sharedUrl
    guard let url = URL(string: "\(serverUrl)/api/cards/quick-capture") else { return }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    var body: [String: Any] = ["project_id": project.id, "title": title]
    if let d = desc { body["description"] = d }
    req.httpBody = try? JSONSerialization.data(withJSONObject: body)
    createButton.isEnabled = false
    spinner.startAnimating()
    URLSession.shared.dataTask(with: req) { [weak self] _, resp, _ in
      DispatchQueue.main.async {
        self?.spinner.stopAnimating()
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if code == 201 || code == 200 {
          self?.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        } else {
          self?.createButton.isEnabled = true
          self?.showError("Erreur lors de la création.")
        }
      }
    }.resume()
  }

  // MARK: - Actions

  @objc private func onProjectTap() {
    guard !projects.isEmpty else { return }
    let alert = UIAlertController(title: "Choisir un projet", message: nil, preferredStyle: .actionSheet)
    for p in projects {
      alert.addAction(UIAlertAction(title: p.name, style: .default) { [weak self] _ in
        self?.selectedProject = p
        self?.projectButton.setTitle(p.name, for: .normal)
      })
    }
    alert.addAction(UIAlertAction(title: "Annuler", style: .cancel))
    present(alert, animated: true)
  }

  @objc private func onCreateTap() { createCard() }

  @objc private func onCancelTap() {
    extensionContext?.cancelRequest(withError: NSError(domain: "hae", code: 0))
  }

  // MARK: - Helpers

  private func showError(_ msg: String) {
    let alert = UIAlertController(title: "hae", message: msg, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in
      self?.extensionContext?.cancelRequest(withError: NSError(domain: "hae", code: 0))
    })
    present(alert, animated: true)
  }

  // MARK: - UI Setup

  private func setupUI() {
    let BRAND = UIColor(red: 0.63, green: 0, blue: 0, alpha: 1)
    let BG    = UIColor(red: 0.98, green: 0.98, blue: 0.97, alpha: 1)

    // Tap outside to cancel
    let tap = UITapGestureRecognizer(target: self, action: #selector(onCancelTap))
    tap.delegate = self
    view.addGestureRecognizer(tap)

    // Container
    containerView.backgroundColor   = BG
    containerView.layer.cornerRadius = 20
    containerView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
    containerView.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(containerView)

    // Handle bar
    handleBar.backgroundColor       = UIColor.systemGray4
    handleBar.layer.cornerRadius    = 2.5
    handleBar.translatesAutoresizingMaskIntoConstraints = false
    containerView.addSubview(handleBar)

    // Title
    titleLabel.text      = "Ajouter à hae"
    titleLabel.font      = .systemFont(ofSize: 17, weight: .bold)
    titleLabel.textColor = UIColor.label
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    containerView.addSubview(titleLabel)

    // Preview box
    previewBox.backgroundColor   = UIColor.systemBackground
    previewBox.layer.cornerRadius = 10
    previewBox.layer.borderWidth  = 1
    previewBox.layer.borderColor  = UIColor.separator.cgColor
    previewBox.translatesAutoresizingMaskIntoConstraints = false
    containerView.addSubview(previewBox)

    previewLabel.font          = .systemFont(ofSize: 13)
    previewLabel.textColor     = .secondaryLabel
    previewLabel.numberOfLines = 3
    previewLabel.translatesAutoresizingMaskIntoConstraints = false
    previewBox.addSubview(previewLabel)

    // Project label
    projectLabel.text      = "PROJET"
    projectLabel.font      = .systemFont(ofSize: 10, weight: .bold)
    projectLabel.textColor = .tertiaryLabel
    projectLabel.translatesAutoresizingMaskIntoConstraints = false
    containerView.addSubview(projectLabel)

    // Project button
    projectButton.setTitle("Chargement…", for: .normal)
    projectButton.setTitleColor(BRAND, for: .normal)
    projectButton.titleLabel?.font    = .systemFont(ofSize: 15, weight: .semibold)
    projectButton.contentHorizontalAlignment = .left
    projectButton.backgroundColor    = UIColor.systemBackground
    projectButton.layer.cornerRadius  = 10
    projectButton.layer.borderWidth   = 1
    projectButton.layer.borderColor   = UIColor.separator.cgColor
    projectButton.contentEdgeInsets   = UIEdgeInsets(top: 12, left: 14, bottom: 12, right: 14)
    projectButton.addTarget(self, action: #selector(onProjectTap), for: .touchUpInside)
    projectButton.translatesAutoresizingMaskIntoConstraints = false
    containerView.addSubview(projectButton)

    // Spinner
    spinner.color = BRAND
    spinner.translatesAutoresizingMaskIntoConstraints = false
    containerView.addSubview(spinner)

    // Create button
    createButton.setTitle("Créer la carte", for: .normal)
    createButton.setTitleColor(.white, for: .normal)
    createButton.titleLabel?.font    = .systemFont(ofSize: 16, weight: .bold)
    createButton.backgroundColor     = BRAND
    createButton.layer.cornerRadius   = 14
    createButton.isEnabled            = false
    createButton.addTarget(self, action: #selector(onCreateTap), for: .touchUpInside)
    createButton.translatesAutoresizingMaskIntoConstraints = false
    containerView.addSubview(createButton)

    // Cancel button
    cancelButton.setTitle("Annuler", for: .normal)
    cancelButton.setTitleColor(.secondaryLabel, for: .normal)
    cancelButton.titleLabel?.font = .systemFont(ofSize: 15)
    cancelButton.addTarget(self, action: #selector(onCancelTap), for: .touchUpInside)
    cancelButton.translatesAutoresizingMaskIntoConstraints = false
    containerView.addSubview(cancelButton)

    let safeBottom = UIApplication.shared.windows.first?.safeAreaInsets.bottom ?? 0

    NSLayoutConstraint.activate([
      containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

      handleBar.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 12),
      handleBar.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
      handleBar.widthAnchor.constraint(equalToConstant: 36),
      handleBar.heightAnchor.constraint(equalToConstant: 5),

      titleLabel.topAnchor.constraint(equalTo: handleBar.bottomAnchor, constant: 16),
      titleLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
      titleLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),

      previewBox.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 14),
      previewBox.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
      previewBox.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),

      previewLabel.topAnchor.constraint(equalTo: previewBox.topAnchor, constant: 10),
      previewLabel.leadingAnchor.constraint(equalTo: previewBox.leadingAnchor, constant: 12),
      previewLabel.trailingAnchor.constraint(equalTo: previewBox.trailingAnchor, constant: -12),
      previewLabel.bottomAnchor.constraint(equalTo: previewBox.bottomAnchor, constant: -10),

      projectLabel.topAnchor.constraint(equalTo: previewBox.bottomAnchor, constant: 18),
      projectLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),

      projectButton.topAnchor.constraint(equalTo: projectLabel.bottomAnchor, constant: 6),
      projectButton.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
      projectButton.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
      projectButton.heightAnchor.constraint(equalToConstant: 48),

      spinner.centerYAnchor.constraint(equalTo: projectButton.centerYAnchor),
      spinner.trailingAnchor.constraint(equalTo: projectButton.trailingAnchor, constant: -14),

      createButton.topAnchor.constraint(equalTo: projectButton.bottomAnchor, constant: 20),
      createButton.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
      createButton.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
      createButton.heightAnchor.constraint(equalToConstant: 52),

      cancelButton.topAnchor.constraint(equalTo: createButton.bottomAnchor, constant: 8),
      cancelButton.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
      cancelButton.heightAnchor.constraint(equalToConstant: 44),
      cancelButton.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -(safeBottom + 8)),
    ])
  }
}

extension ShareViewController: UIGestureRecognizerDelegate {
  func gestureRecognizer(_ gr: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
    return touch.view == view
  }
}
