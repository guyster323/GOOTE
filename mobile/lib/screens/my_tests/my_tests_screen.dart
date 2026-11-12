import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_session.dart';

class MyTestsScreen extends StatelessWidget {
  const MyTestsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final myTests = context.watch<AppSession>().myTests;

    if (myTests.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('진행 중인 테스트가 없습니다. 일일 체크인과 종료 로직은 다음 단계에서 연결하면 됩니다.'),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: myTests.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final test = myTests[index];
        return Card(
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            title: Text(test.appName),
            subtitle: Text('상태 ${test.status} · 연속 ${test.consecutiveDays}일 · 목표 ${test.targetDays}일'),
            trailing: const Icon(Icons.checklist_rtl_outlined),
          ),
        );
      },
    );
  }
}
