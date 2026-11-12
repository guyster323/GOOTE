import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../models/app_listing.dart';
import '../../services/app_service.dart';

class AppDetailScreen extends StatelessWidget {
  const AppDetailScreen({
    super.key,
    required this.appId,
    required this.appService,
  });

  final String appId;
  final AppService appService;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('앱 상세')),
      body: StreamBuilder<AppListing?>(
        stream: appService.watchApp(appId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final app = snapshot.data;
          if (app == null) {
            return const Center(child: Text('앱을 찾을 수 없습니다.'));
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(app.name, style: Theme.of(context).textTheme.headlineSmall),
                      const SizedBox(height: 8),
                      Text('개발자: ${app.developerNickname.isEmpty ? app.developerId : app.developerNickname}'),
                      const SizedBox(height: 12),
                      Text(app.description.isEmpty ? '설명이 아직 등록되지 않았습니다.' : app.description),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _InfoChip(label: '상태', value: app.status),
                          _InfoChip(label: '기간', value: '${app.testDuration}일'),
                          _InfoChip(label: '참여자', value: '${app.participants}명'),
                          _InfoChip(label: '일일 참여', value: '${app.dailyParticipants}명'),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Planned mobile actions', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 12),
                      const Text('• Join flow should call requestParticipation after Google Groups open.'),
                      const Text('• Daily check-in should use createDailyTrackLink for Android/Web.'),
                      const Text('• Comments, likes, and mutual-testing checks are not filled in yet.'),
                      const SizedBox(height: 16),
                      FilledButton.tonal(
                        onPressed: app.googleGroupLink.isEmpty
                            ? null
                            : () => _openExternal(app.googleGroupLink),
                        child: const Text('Open Google Groups link'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _openExternal(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      return;
    }
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Chip(label: Text('$label · $value'));
  }
}
