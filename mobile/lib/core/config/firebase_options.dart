import 'package:firebase_core/firebase_core.dart';

class GooteFirebaseConfig {
  const GooteFirebaseConfig._();

  static const String apiKey = String.fromEnvironment(
    'GOOTE_FIREBASE_API_KEY',
    defaultValue: '',
  );
  static const String appId = String.fromEnvironment(
    'GOOTE_FIREBASE_APP_ID_ANDROID',
    defaultValue: '',
  );
  static const String messagingSenderId = String.fromEnvironment(
    'GOOTE_FIREBASE_MESSAGING_SENDER_ID',
    defaultValue: '464908559865',
  );
  static const String projectId = String.fromEnvironment(
    'GOOTE_FIREBASE_PROJECT_ID',
    defaultValue: 'goote-f48d8',
  );
  static const String storageBucket = String.fromEnvironment(
    'GOOTE_FIREBASE_STORAGE_BUCKET',
    defaultValue: 'goote-f48d8.firebasestorage.app',
  );

  static bool get isConfigured =>
      apiKey.isNotEmpty &&
      appId.isNotEmpty &&
      messagingSenderId.isNotEmpty &&
      projectId.isNotEmpty;

  static FirebaseOptions get android => const FirebaseOptions(
        apiKey: apiKey,
        appId: appId,
        messagingSenderId: messagingSenderId,
        projectId: projectId,
        storageBucket: storageBucket,
      );
}
