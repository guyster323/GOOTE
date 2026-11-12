import 'package:flutter/material.dart';

import '../../models/app_listing.dart';
import '../../services/app_service.dart';
import '../apps/app_detail_screen.dart';

class ExploreScreen extends StatelessWidget {
  const ExploreScreen({super.key, required this.appService});

  final AppService appService;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<AppListing>>(
      stream: appService.watchExploreApps(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final items = snapshot.data ?? const <AppListing>[];
        if (items.isEmpty) {
          return const Center(child: Text('현재 모집 중인 앱이 없습니다.'));
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final app = items[index];
            return Card(
              child: ListTile(
                contentPadding: const EdgeInsets.all(16),
                title: Text(app.name),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    '${app.category} · ${app.testDuration}일 · ${app.participants}명 참여',
                  ),
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => AppDetailScreen(
                        appId: app.id,
                        appService: appService,
                      ),
                    ),
                  );
                },
              ),
            );
          },
        );
      },
    );
  }
}
