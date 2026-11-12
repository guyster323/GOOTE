import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_session.dart';
import '../auth/auth_shell_screen.dart';
import '../home/home_shell_screen.dart';

class BootstrapGate extends StatelessWidget {
  const BootstrapGate({
    super.key,
    required this.firebaseReady,
    required this.bootstrapMessage,
  });

  final bool firebaseReady;
  final String bootstrapMessage;

  @override
  Widget build(BuildContext context) {
    if (!firebaseReady) {
      return Scaffold(
        appBar: AppBar(title: const Text('GOOTE Mobile')),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Firebase setup needed',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 12),
                Text(bootstrapMessage),
                const SizedBox(height: 12),
                const Text(
                  'Expected next step: add Android Firebase credentials for project goote-f48d8 and replace the temporary auth flow with Google sign-in.',
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Consumer<AppSession>(
      builder: (context, session, _) {
        if (!session.bootstrapComplete || session.isBusy) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (session.user == null) {
          return const AuthShellScreen();
        }

        return const HomeShellScreen();
      },
    );
  }
}
