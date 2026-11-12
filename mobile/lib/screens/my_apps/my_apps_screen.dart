import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_session.dart';

class MyAppsScreen extends StatelessWidget {
  const MyAppsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final myApps = context.watch<AppSession>().myApps;

    if (myApps.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('등록된 앱이 없습니다. 앱 등록 폼과 관리 화면은 다음 단계에서 연결하면 됩니다.'),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: myApps.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final app = myApps[index];
        return Card(
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            title: Text(app.name),
            subtitle: Text('상태 ${app.status} · 참여자 ${app.participants}명'),
            trailing: const Icon(Icons.construction_outlined),
          ),
        );
      },
    );
  }
}
