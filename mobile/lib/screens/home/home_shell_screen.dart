import 'package:flutter/material.dart';

import '../../services/app_service.dart';
import '../explore/explore_screen.dart';
import '../my_apps/my_apps_screen.dart';
import '../my_tests/my_tests_screen.dart';
import '../profile/profile_screen.dart';

class HomeShellScreen extends StatefulWidget {
  const HomeShellScreen({super.key});

  @override
  State<HomeShellScreen> createState() => _HomeShellScreenState();
}

class _HomeShellScreenState extends State<HomeShellScreen> {
  int _index = 0;
  final _appService = AppService();

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      ExploreScreen(appService: _appService),
      const MyAppsScreen(),
      const MyTestsScreen(),
      const ProfileScreen(),
    ];

    final titles = ['탐색', '내 앱', '내 테스트', '프로필'];

    return Scaffold(
      appBar: AppBar(title: Text(titles[_index])),
      body: SafeArea(child: pages[_index]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.explore_outlined), label: '탐색'),
          NavigationDestination(icon: Icon(Icons.apps_outlined), label: '내 앱'),
          NavigationDestination(icon: Icon(Icons.check_circle_outline), label: '내 테스트'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: '프로필'),
        ],
      ),
    );
  }
}
