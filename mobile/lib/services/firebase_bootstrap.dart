import 'package:firebase_core/firebase_core.dart';

import '../core/config/firebase_options.dart';

class FirebaseBootstrapResult {
  const FirebaseBootstrapResult({
    required this.initialized,
    required this.message,
  });

  final bool initialized;
  final String message;
}

class FirebaseBootstrap {
  const FirebaseBootstrap._();

  static Future<FirebaseBootstrapResult> initialize() async {
    if (Firebase.apps.isNotEmpty) {
      return const FirebaseBootstrapResult(
        initialized: true,
        message: 'Firebase already initialized.',
      );
    }

    if (!GooteFirebaseConfig.isConfigured) {
      return const FirebaseBootstrapResult(
        initialized: false,
        message:
            'Android Firebase app credentials are missing. Pass --dart-define values or add google-services.json before running the app.',
      );
    }

    await Firebase.initializeApp(options: GooteFirebaseConfig.android);

    return const FirebaseBootstrapResult(
      initialized: true,
      message: 'Firebase initialized.',
    );
  }
}
