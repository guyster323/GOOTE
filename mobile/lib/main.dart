import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/theme/app_theme.dart';
import 'screens/bootstrap/bootstrap_gate.dart';
import 'services/app_service.dart';
import 'services/auth_service.dart';
import 'services/firebase_bootstrap.dart';
import 'services/participation_service.dart';
import 'services/profile_service.dart';
import 'state/app_session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final bootstrap = await FirebaseBootstrap.initialize();

  runApp(GooteApp(bootstrap: bootstrap));
}

class GooteApp extends StatelessWidget {
  const GooteApp({super.key, required this.bootstrap});

  final FirebaseBootstrapResult bootstrap;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppSession(
        authService: AuthService(),
        profileService: ProfileService(),
        appService: AppService(),
        participationService: ParticipationService(),
      ),
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'GOOTE',
        theme: AppTheme.light(),
        home: BootstrapGate(
          firebaseReady: bootstrap.initialized,
          bootstrapMessage: bootstrap.message,
        ),
      ),
    );
  }
}
