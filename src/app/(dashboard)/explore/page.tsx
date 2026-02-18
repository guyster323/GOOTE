"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Users, Calendar, Search, ArrowRight } from "lucide-react";
import Link from "next/link";

interface App {
  id: string;
  name: string;
  category: string;
  developerNickname: string;
  testDuration: number;
  participationLink: string;
  stats: {
    participants: number;
  };
}

export default function ExplorePage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      const q = query(collection(db, "apps"), where("status", "==", "recruiting"));
      const querySnapshot = await getDocs(q);
      const fetchedApps = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as App[];
      setApps(fetchedApps);
    } catch (error) {
      console.error("Error fetching apps:", error);
      toast.error("앱을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const filteredApps = apps.filter((app) => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.developerNickname.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || app.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categories = [
    { id: "all", label: "전체" },
    { id: "game", label: "게임" },
    { id: "utility", label: "유틸리티" },
    { id: "productivity", label: "생산성" },
    { id: "other", label: "기타" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">앱 탐색</h1>
          <p className="text-muted-foreground text-lg">
            새로운 앱을 발견하고, 개발자를 돕고, 보상을 받으세요.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="앱 이름 또는 개발자 검색..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={categoryFilter === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat.id)}
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {filteredApps.length === 0 ? (
        <div className="flex h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed text-center p-8">
          <p className="text-muted-foreground">
            {searchTerm || categoryFilter !== "all"
              ? "검색 조건에 맞는 앱이 없습니다."
              : "현재 모집 중인 앱이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredApps.map((app) => (
            <Card key={app.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-xl line-clamp-1">{app.name}</CardTitle>
                  <Badge variant="secondary">
                    {categories.find(c => c.id === app.category)?.label || app.category}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  개발자: {app.developerNickname}
                </p>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{app.testDuration}일</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{app.stats.participants}명의 테스터</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button
                  className="w-full h-11 font-bold"
                  asChild
                >
                  <Link href={`/apps/${app.id}`}>
                    상세보기 및 참여요청
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
