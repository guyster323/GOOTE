import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_session.dart';

class AuthShellScreen extends StatelessWidget {
  const AuthShellScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AppSession>();

    return Scaffold(
      appBar: AppBar(title: const Text('GOOTE')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'GOOTE mobile scaffold',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'First-pass auth shell for the Android app. Google sign-in is not wired yet because the repo does not include Android Firebase app credentials.',
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: session.isBusy
                          ? null
                          : () => context.read<AppSession>().signInForDevelopment(),
                      child: const Text('Continue with temporary dev auth'),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      session.errorMessage ?? 'This button uses anonymous auth only as a temporary scaffold path.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
