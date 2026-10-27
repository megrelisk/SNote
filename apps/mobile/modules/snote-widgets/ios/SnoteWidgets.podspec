Pod::Spec.new do |s|
  s.name           = 'SnoteWidgets'
  s.version        = '1.0.0'
  s.summary        = 'SNote widget shared storage bridge'
  s.description    = 'Writes widget snapshots to the App Group and reads Quick Capture queues.'
  s.license        = 'MIT'
  s.author         = 'SNote'
  s.homepage       = 'https://github.com/megrelisk/SNote'
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
