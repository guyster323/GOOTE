import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_session.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AppSession>();
    final profile = session.profile;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(profile?.nickname.isNotEmpty == true ? profile!.nickname : 'GOOTE User',
                    style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 8),
                Text(profile?.email.isNotEmpty == true ? profile!.email : 'Firebase profile pending'),
                const SizedBox(height: 16),
                Text('역할: ${profile?.role ?? 'user'}'),
                Text('등록한 앱: ${profile?.appsRegistered ?? 0}'),
                Text('참여 테스트: ${profile?.testsJoined ?? 0}'),
                const SizedBox(height: 20),
                OutlinedButton(
                  onPressed: session.isBusy ? null : () => context.read<AppSession>().signOut(),
                  child: const Text('로그아웃'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
